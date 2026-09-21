"""WriteWise — Research Dataset Export & Anonymization Tool.

Pulls paired handwriting data (raw CV measurements + teacher manual rubric scores + word crops)
from the Supabase database and Storage, anonymizes student/submission identifiers per RA 10173
and project security rules (SECURITY.md §6, ARCHITECTURE.md §16, AGENTS.md §6 rules #1 and #11),
and produces:
1. `paired_measurements.csv` for Spearman's Rank Correlation and threshold derivation.
2. `paired_crops.csv` + `crops/` directory for CNN Stage 2 calibration (stage2_calibrate.py).
3. `export_summary.txt` documenting distribution and anonymization for thesis methodology.

Usage:
    python research/export_dataset.py [--output-dir research/output] [--no-crops] [--limit 150]
"""

import argparse
import csv
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Add backend directory to sys.path so app modules can be imported
repo_root = Path(__file__).resolve().parent.parent
backend_dir = repo_root / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("export_dataset")


def load_env_file(env_path: Optional[Path] = None) -> None:
    """Load environment variables from .env file if available."""
    candidate_paths = [
        env_path,
        backend_dir / ".env",
        repo_root / ".env",
    ]
    for p in candidate_paths:
        if p and p.is_file():
            logger.info("Loading environment variables from %s", p)
            with open(p, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k not in os.environ:
                            os.environ[k] = v
            break


def get_supabase_client(env_path: Optional[Path] = None):
    """Initialize Supabase client using service-role key (offline research tool)."""
    load_env_file(env_path)

    supabase_url = os.environ.get("SUPABASE_URL")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_role_key:
        raise ValueError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the "
            "environment or .env file."
        )

    from supabase import create_client

    return create_client(supabase_url, service_role_key)


def anonymize_id(original_id: str, mapping: Dict[str, str], prefix: str = "ENTITY") -> str:
    """Map a UUID to a deterministic sequential opaque code (e.g. STUDENT_001)."""
    if original_id not in mapping:
        new_index = len(mapping) + 1
        mapping[original_id] = f"{prefix}_{new_index:03d}"
    return mapping[original_id]


def filter_paired_records(
    submissions: List[Dict[str, Any]],
    measurements: Dict[str, Dict[str, Any]],
    manual_scores: Dict[str, Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Filter to only completed submissions having both measurement and manual_score."""
    paired = []
    for sub in submissions:
        sub_id = sub.get("id")
        if not sub_id:
            continue
        if sub.get("status") != "completed":
            continue

        meas = measurements.get(sub_id)
        m_score = manual_scores.get(sub_id)

        if meas and m_score:
            paired.append(
                {
                    "submission": sub,
                    "measurement": meas,
                    "manual_score": m_score,
                }
            )
    return paired


def fetch_paired_records(
    client,
    limit: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Fetch completed submissions, measurements, and manual scores from Supabase."""
    logger.info("Fetching completed submissions...")
    sub_query = client.table("submission").select("*").eq("status", "completed")
    if limit:
        sub_query = sub_query.limit(limit)
    sub_res = sub_query.execute()
    submissions = sub_res.data or []
    logger.info("Retrieved %d completed submissions.", len(submissions))

    if not submissions:
        return []

    sub_ids = [s["id"] for s in submissions]

    # Chunk queries if needed for supabase in_ filter
    measurements_map: Dict[str, Dict[str, Any]] = {}
    manual_scores_map: Dict[str, Dict[str, Any]] = {}

    chunk_size = 100
    for i in range(0, len(sub_ids), chunk_size):
        chunk = sub_ids[i : i + chunk_size]

        meas_res = client.table("measurement").select("*").in_("submission_id", chunk).execute()
        for m in meas_res.data or []:
            measurements_map[m["submission_id"]] = m

        ms_res = client.table("manual_score").select("*").in_("submission_id", chunk).execute()
        for ms in ms_res.data or []:
            manual_scores_map[ms["submission_id"]] = ms

    paired = filter_paired_records(submissions, measurements_map, manual_scores_map)
    logger.info("Found %d paired records (having both measurement and manual score).", len(paired))
    return paired


def build_measurements_records(
    paired_records: List[Dict[str, Any]],
    student_map: Dict[str, str],
    submission_map: Dict[str, str],
) -> List[Dict[str, Any]]:
    """Build anonymized tabular records for Spearman's Rho and threshold analysis."""
    records = []
    for item in paired_records:
        sub = item["submission"]
        meas = item["measurement"]
        ms = item["manual_score"]

        student_code = anonymize_id(sub["student_id"], student_map, prefix="STUDENT")
        submission_code = anonymize_id(sub["id"], submission_map, prefix="SUBMISSION")

        row = {
            "student_code": student_code,
            "submission_code": submission_code,
            # Raw CV / CNN measurements (6 metric pairs)
            "slant_mean": meas.get("slant_mean"),
            "slant_std": meas.get("slant_std"),
            "word_spacing_mean": meas.get("word_spacing_mean"),
            "word_spacing_std": meas.get("word_spacing_std"),
            "letter_spacing_mean": meas.get("letter_spacing_mean"),
            "letter_spacing_std": meas.get("letter_spacing_std"),
            "baseline_deviation_mean": meas.get("baseline_deviation_mean"),
            "baseline_deviation_std": meas.get("baseline_deviation_std"),
            "size_consistency_mean": meas.get("size_consistency_mean"),
            "size_consistency_std": meas.get("size_consistency_std"),
            "letter_formation_mean": meas.get("letter_formation_mean"),
            "letter_formation_std": meas.get("letter_formation_std"),
            # Teacher manual rubric scores (5 criteria)
            "manual_letter_formation_band": ms.get("letter_formation_band"),
            "manual_letter_formation_score": ms.get("letter_formation_score"),
            "manual_size_consistency_band": ms.get("size_consistency_band"),
            "manual_size_consistency_score": ms.get("size_consistency_score"),
            "manual_spacing_band": ms.get("spacing_band"),
            "manual_spacing_score": ms.get("spacing_score"),
            "manual_slant_band": ms.get("slant_band"),
            "manual_slant_score": ms.get("slant_score"),
            "manual_baseline_alignment_band": ms.get("baseline_alignment_band"),
            "manual_baseline_alignment_score": ms.get("baseline_alignment_score"),
        }
        records.append(row)
    return records


def build_crop_records(
    paired_records: List[Dict[str, Any]],
    submission_map: Dict[str, str],
    crops_relative_dir: str = "crops",
) -> List[Dict[str, Any]]:
    """Build metadata rows for word crops matching stage2_calibrate.py schema."""
    crop_records = []
    for item in paired_records:
        sub = item["submission"]
        meas = item["measurement"]
        ms = item["manual_score"]

        submission_code = anonymize_id(sub["id"], submission_map, prefix="SUBMISSION")
        raw_output = meas.get("raw_output") or {}

        # Collect words from raw_output
        word_count = 0
        lines = raw_output.get("lines", [])
        for line in lines:
            for word in line.get("words", []):
                crop_filename = f"{submission_code}_word_{word_count:03d}.jpg"
                crop_rel_path = f"{crops_relative_dir}/{crop_filename}"

                crop_records.append(
                    {
                        "crop_path": crop_rel_path,
                        "submission_code": submission_code,
                        "word_index": word_count,
                        "band": ms.get("letter_formation_band"),
                        "score": ms.get("letter_formation_score"),
                        "bbox": word.get("bbox"),
                    }
                )
                word_count += 1
    return crop_records


def download_and_extract_crops(
    client,
    paired_records: List[Dict[str, Any]],
    submission_map: Dict[str, str],
    output_crops_dir: Path,
) -> Tuple[List[Dict[str, Any]], int]:
    """Download images from Storage and extract word crops."""
    import cv2

    from app.cv.guide_lines import detect_and_deskew
    from app.cv.preprocessing import preprocess
    from app.cv.segmentation import segment_lines_and_words

    output_crops_dir.mkdir(parents=True, exist_ok=True)
    all_crop_records = []
    failed_downloads = 0

    for item in paired_records:
        sub = item["submission"]
        ms = item["manual_score"]
        sub_id = sub["id"]
        submission_code = anonymize_id(sub_id, submission_map, prefix="SUBMISSION")
        image_path = sub.get("image_path")

        if not image_path:
            logger.warning("Submission %s missing image_path, skipping crops.", submission_code)
            failed_downloads += 1
            continue

        try:
            logger.info("Downloading image for %s...", submission_code)
            image_bytes = client.storage.from_("submission-images").download(image_path)
            if not image_bytes:
                raise ValueError("Empty image response from storage.")
        except Exception as exc:
            logger.error("Failed to download image for %s: %s", submission_code, exc)
            failed_downloads += 1
            continue

        # Extract word crops using CV pipeline stages
        try:
            prep = preprocess(image_bytes)
            deskew = detect_and_deskew(prep)
            segmentation = segment_lines_and_words(deskew=deskew)

            word_idx = 0
            for line in segmentation.lines:
                for word in line.words:
                    crop_filename = f"{submission_code}_word_{word_idx:03d}.jpg"
                    crop_file_path = output_crops_dir / crop_filename

                    # Save word crop image
                    cv2.imwrite(str(crop_file_path), word.gray_crop)

                    all_crop_records.append(
                        {
                            "crop_path": f"crops/{crop_filename}",
                            "submission_code": submission_code,
                            "word_index": word_idx,
                            "band": ms.get("letter_formation_band"),
                            "score": ms.get("letter_formation_score"),
                        }
                    )
                    word_idx += 1

            logger.info("Saved %d crops for %s.", word_idx, submission_code)
        except Exception as exc:
            logger.error("Failed to extract crops for %s: %s", submission_code, exc)
            failed_downloads += 1

    return all_crop_records, failed_downloads


def calculate_summary_stats(paired_records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate counts and score band distributions across criteria."""
    total_submissions = len(paired_records)
    student_ids = {item["submission"]["student_id"] for item in paired_records}

    criteria = [
        "letter_formation",
        "size_consistency",
        "spacing",
        "slant",
        "baseline_alignment",
    ]
    bands = ["needs_improvement", "developing", "satisfactory", "excellent"]

    band_distribution = {c: {b: 0 for b in bands} for c in criteria}

    for item in paired_records:
        ms = item["manual_score"]
        for c in criteria:
            band = ms.get(f"{c}_band")
            if band in band_distribution[c]:
                band_distribution[c][band] += 1

    return {
        "total_submissions": total_submissions,
        "unique_students": len(student_ids),
        "band_distribution": band_distribution,
    }


def format_summary_report(stats: Dict[str, Any], crop_count: int = 0) -> str:
    """Generate human-readable summary text for terminal and summary file."""
    lines = [
        "=" * 64,
        "WriteWise — Calibration Dataset Export Summary",
        f"Generated at (UTC): {datetime.now(timezone.utc).isoformat()}",
        "=" * 64,
        f"Total Paired Submissions: {stats['total_submissions']}",
        f"Unique Anonymized Students: {stats['unique_students']}",
        f"Total Word Crops Extracted: {crop_count}",
        "-" * 64,
        "Rubric Band Distributions (Teacher Manual Scores):",
    ]

    total = max(1, stats["total_submissions"])
    for criterion, dist in stats["band_distribution"].items():
        title = criterion.replace("_", " ").title()
        lines.append(f"\n[{title}]")
        for band, count in dist.items():
            pct = (count / total) * 100
            band_name = band.replace("_", " ").title()
            lines.append(f"  - {band_name:20s}: {count:4d} ({pct:5.1f}%)")

    lines.append("\n" + "=" * 64)
    lines.append("RA 10173 & Privacy Compliance Statement:")
    lines.append("  - All student identifiers replaced with opaque sequential codes.")
    lines.append("  - Names, emails, timestamps, and EXIF geolocation stripped.")
    lines.append("  - Output stored locally in gitignored research/output/ directory.")
    lines.append("=" * 64)
    return "\n".join(lines)


def run_export(
    output_dir: Path,
    env_file: Optional[Path] = None,
    include_crops: bool = True,
    limit: Optional[int] = None,
    dry_run: bool = False,
) -> None:
    """Execute complete export and anonymization workflow."""
    logger.info("Initializing WriteWise dataset export...")
    client = get_supabase_client(env_file)

    paired_records = fetch_paired_records(client, limit=limit)
    if not paired_records:
        logger.warning("No paired records found to export.")
        return

    student_map: Dict[str, str] = {}
    submission_map: Dict[str, str] = {}

    stats = calculate_summary_stats(paired_records)

    if dry_run:
        logger.info("DRY RUN: No files written. Summary preview:")
        print(format_summary_report(stats))
        return

    output_dir.mkdir(parents=True, exist_ok=True)

    # 1. Write paired_measurements.csv
    measurements_records = build_measurements_records(paired_records, student_map, submission_map)
    measurements_csv_path = output_dir / "paired_measurements.csv"

    if measurements_records:
        fieldnames = list(measurements_records[0].keys())
        with open(measurements_csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(measurements_records)
        logger.info("Wrote %s (%d rows)", measurements_csv_path, len(measurements_records))

    # 2. Extract word crops & write paired_crops.csv
    total_crops = 0
    if include_crops:
        crops_dir = output_dir / "crops"
        crop_records, failed_crops = download_and_extract_crops(
            client,
            paired_records,
            submission_map,
            output_crops_dir=crops_dir,
        )
        total_crops = len(crop_records)

        crops_csv_path = output_dir / "paired_crops.csv"
        if crop_records:
            fieldnames = ["crop_path", "submission_code", "word_index", "band", "score"]
            with open(crops_csv_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                for cr in crop_records:
                    writer.writerow({k: cr[k] for k in fieldnames})
            logger.info("Wrote %s (%d crops)", crops_csv_path, len(crop_records))
    else:
        logger.info("Skipping crop extraction (--no-crops enabled).")

    # 3. Write summary report
    report_text = format_summary_report(stats, crop_count=total_crops)
    summary_path = output_dir / "export_summary.txt"
    with open(summary_path, "w", encoding="utf-8") as f:
        f.write(report_text)
    logger.info("Wrote %s", summary_path)

    print("\n" + report_text)


def main():
    parser = argparse.ArgumentParser(
        description="Export paired WriteWise calibration dataset with student anonymization."
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=repo_root / "research" / "output",
        help="Directory to save exported CSVs and word crops (default: research/output)",
    )
    parser.add_argument(
        "--env-file",
        type=Path,
        default=None,
        help="Path to .env file containing Supabase credentials",
    )
    parser.add_argument(
        "--no-crops",
        action="store_true",
        help="Skip image downloads and word crop extraction",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit number of paired records to export",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only display counts and summary without writing files",
    )

    args = parser.parse_args()

    try:
        run_export(
            output_dir=args.output_dir,
            env_file=args.env_file,
            include_crops=not args.no_crops,
            limit=args.limit,
            dry_run=args.dry_run,
        )
    except Exception as exc:
        logger.error("Dataset export failed: %s", exc)
        sys.exit(1)


if __name__ == "__main__":
    main()
