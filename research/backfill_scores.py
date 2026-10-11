"""WriteWise — Backfill Calibrated Scores.

Computes 0-100 calibrated scores for all existing measurement rows that currently
have NULL scores, using the CalibratedScoreProvider and stored CV metrics.
This activates Phase 2 presentation mode and populates dashboards for historical submissions.

Usage:
    cd backend && uv run python ../research/backfill_scores.py
"""

import logging
import os
import sys
from pathlib import Path

repo_root = Path(__file__).resolve().parent.parent
backend_dir = repo_root / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

env_file = backend_dir / ".env"
if env_file.is_file():
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip("'\""))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("backfill_scores")


def backfill_all():
    from app.core.supabase import supabase_client
    from app.scoring.provider import CalibratedScoreProvider

    logger.info("Connecting to Supabase to fetch measurements without calibrated scores...")
    res = supabase_client.table("measurement").select("*").execute()
    measurements = res.data or []

    provider = CalibratedScoreProvider()
    updated_count = 0

    for m in measurements:
        if m.get("composite_score") is not None:
            continue

        measurement_id = m.get("id")
        submission_id = m.get("submission_id")

        formation_mean = m.get("letter_formation_mean")
        scores = provider.compute_scores(m, ml_result=formation_mean)
        db_payload = scores.to_db_dict()

        upd_res = (
            supabase_client.table("measurement")
            .update(db_payload)
            .eq("id", measurement_id)
            .execute()
        )

        if upd_res.data:
            updated_count += 1
            logger.info(
                "Backfilled submission %s (id: %s) -> scores: %s",
                submission_id,
                measurement_id,
                db_payload,
            )
        else:
            logger.warning("Failed to update measurement id: %s", measurement_id)

    logger.info(
        "Backfill complete! %d out of %d measurements updated with calibrated scores.",
        updated_count,
        len(measurements),
    )


if __name__ == "__main__":
    backfill_all()
