import logging
import statistics
from typing import Any

from app.diagnostic.models import (
    BaselineAnnotation,
    BaselineOverlay,
    DiagnosticOverlay,
    FormationAnnotation,
    FormationOverlay,
    GuideLinesData,
    OverlaySummary,
    SizeAnnotation,
    SizeOverlay,
    SlantAnnotation,
    SlantOverlay,
    SpacingAnnotation,
    SpacingOverlay,
)
from app.diagnostic.rules import (
    SLANT_LINE_RANGE_MAX,
    SLANT_LINE_STDEV_MAX,
    evaluate_baseline_drift,
    evaluate_letter_formation,
    evaluate_size_consistency,
    evaluate_slant,
    evaluate_word_gap,
)

logger = logging.getLogger(__name__)


def generate_diagnostic_overlay(raw_output: dict[str, Any]) -> dict[str, Any]:
    """Pure functional transformer converting CV raw_output to DiagnosticOverlay JSON."""
    try:
        gl_raw = raw_output.get("guide_lines") or {}
        guide_lines = GuideLinesData(
            baseline_y=gl_raw.get("baseline_y", []),
            midline_y=gl_raw.get("midline_y", []),
            topline_y=gl_raw.get("topline_y", []),
        )

        baseline_annotations: list[BaselineAnnotation] = []
        spacing_annotations: list[SpacingAnnotation] = []
        size_annotations: list[SizeAnnotation] = []
        slant_annotations: list[SlantAnnotation] = []
        formation_annotations: list[FormationAnnotation] = []

        attention_counts = {
            "baseline_alignment": 0,
            "spacing": 0,
            "size_consistency": 0,
            "slant": 0,
            "letter_formation": 0,
        }

        lines = raw_output.get("lines") or []
        for line in lines:
            line_idx = line.get("line_index", 0)
            words = line.get("words") or []
            word_gaps = line.get("word_gaps") or []

            # Line-level slant statistics
            line_slants = [
                float(w["slant_deg"])
                for w in words
                if w.get("slant_deg") is not None
            ]
            line_median_slant: float | None = None
            is_high_slant_variance = False

            if line_slants:
                line_median_slant = float(statistics.median(line_slants))
                if len(line_slants) >= 2:
                    std_slant = statistics.stdev(line_slants)
                    range_slant = max(line_slants) - min(line_slants)
                    if std_slant > SLANT_LINE_STDEV_MAX or range_slant > SLANT_LINE_RANGE_MAX:
                        is_high_slant_variance = True

            # Word-level annotations
            for word in words:
                w_idx = word.get("word_index", 0)
                bbox = word.get("bbox", [0, 0, 0, 0])

                # 1. Baseline
                drift = word.get("baseline_deviation_ratio", 0.0)
                b_sev, b_note = evaluate_baseline_drift(drift)
                if b_sev == "needs_attention":
                    attention_counts["baseline_alignment"] += 1
                baseline_annotations.append(
                    BaselineAnnotation(
                        line_index=line_idx,
                        word_index=w_idx,
                        bbox=bbox,
                        deviation_ratio=round(drift, 3),
                        severity=b_sev,
                        note=b_note,
                        measured_y=word.get("measured_baseline_y"),
                    )
                )

                # 2. Size
                size_ratio = word.get("size_ratio", 1.0)
                sz_sev, sz_note = evaluate_size_consistency(size_ratio)
                if sz_sev == "needs_attention":
                    attention_counts["size_consistency"] += 1

                core_bbox: list[int] | None = None
                if (
                    line_idx < len(guide_lines.midline_y)
                    and line_idx < len(guide_lines.baseline_y)
                ):
                    mid_y = guide_lines.midline_y[line_idx]
                    base_y = guide_lines.baseline_y[line_idx]
                    if base_y > mid_y:
                        core_bbox = [bbox[0], mid_y, bbox[2], base_y - mid_y]

                size_annotations.append(
                    SizeAnnotation(
                        line_index=line_idx,
                        word_index=w_idx,
                        bbox=bbox,
                        size_ratio=round(size_ratio, 2),
                        severity=sz_sev,
                        note=sz_note,
                        core_bbox=core_bbox,
                    )
                )

                # 3. Slant
                slant_deg = word.get("slant_deg", 0.0)
                sl_sev, vector, sl_note = evaluate_slant(
                    slant_deg,
                    bbox,
                    line_median=line_median_slant,
                    is_high_variance=is_high_slant_variance,
                )
                if sl_sev == "needs_attention":
                    attention_counts["slant"] += 1
                slant_annotations.append(
                    SlantAnnotation(
                        line_index=line_idx,
                        word_index=w_idx,
                        bbox=bbox,
                        angle_deg=round(slant_deg, 1),
                        vector=vector,
                        severity=sl_sev,
                        note=sl_note,
                    )
                )

                # 4. Letter Formation
                score = word.get("letter_formation_score")
                saliency_polys = word.get("saliency_polygons") or []
                f_sev, band, f_note = evaluate_letter_formation(score)
                if f_sev == "needs_attention":
                    attention_counts["letter_formation"] += 1
                formation_annotations.append(
                    FormationAnnotation(
                        line_index=line_idx,
                        word_index=w_idx,
                        bbox=bbox,
                        score=round(score if score is not None else 65.0, 1),
                        band=band,
                        severity=f_sev,
                        note=f_note,
                        saliency_polygons=saliency_polys,
                    )
                )

            # Spacing between consecutive words
            for gap_idx, gap_ratio in enumerate(word_gaps):
                if gap_idx + 1 < len(words):
                    w1_bbox = words[gap_idx].get("bbox", [0, 0, 0, 0])
                    w2_bbox = words[gap_idx + 1].get("bbox", [0, 0, 0, 0])
                    x1 = w1_bbox[0] + w1_bbox[2]
                    x2 = w2_bbox[0]
                    y = w1_bbox[1] + w1_bbox[3] // 2
                else:
                    x1, x2, y = 0, 0, 0

                sp_sev, sp_note = evaluate_word_gap(gap_ratio)
                if sp_sev == "needs_attention":
                    attention_counts["spacing"] += 1
                spacing_annotations.append(
                    SpacingAnnotation(
                        line_index=line_idx,
                        gap_index=gap_idx,
                        x1=x1,
                        x2=x2,
                        y=y,
                        gap_ratio=round(gap_ratio, 2),
                        severity=sp_sev,
                        note=sp_note,
                    )
                )

        weakest = max(attention_counts, key=lambda k: attention_counts[k])
        total_attention = sum(attention_counts.values())

        overlay = DiagnosticOverlay(
            summary=OverlaySummary(
                weakest_criterion=weakest,
                attention_item_count=total_attention,
            ),
            baseline=BaselineOverlay(
                guide_lines=guide_lines,
                annotations=baseline_annotations,
            ),
            spacing=SpacingOverlay(annotations=spacing_annotations),
            size=SizeOverlay(annotations=size_annotations),
            slant=SlantOverlay(annotations=slant_annotations),
            letter_formation=FormationOverlay(annotations=formation_annotations),
        )
        return overlay.model_dump()
    except Exception as exc:
        logger.error("Failed to generate diagnostic overlay: %s", exc)
        return {
            "summary": {"weakest_criterion": "none", "attention_item_count": 0},
            "baseline": {
                "guide_lines": {"baseline_y": [], "midline_y": [], "topline_y": []},
                "annotations": [],
            },
            "spacing": {"annotations": []},
            "size": {"annotations": []},
            "slant": {"annotations": []},
            "letter_formation": {"annotations": []},
        }
