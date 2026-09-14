import math
from typing import Literal

Severity = Literal["normal", "needs_attention"]

# Thresholds per Spec §3.3
BASELINE_DRIFT_THRESHOLD = 0.10
WORD_GAP_MIN_RATIO = 1.2
WORD_GAP_MAX_RATIO = 3.0
SIZE_RATIO_MIN = 0.75
SIZE_RATIO_MAX = 1.25
SLANT_MIN_DEG = -5.0
SLANT_MAX_DEG = 30.0
FORMATION_SCORE_THRESHOLD = 62.5


def evaluate_baseline_drift(deviation_ratio: float) -> tuple[Severity, str]:
    abs_dev = abs(deviation_ratio)
    pct = round(abs_dev * 100)
    if abs_dev > BASELINE_DRIFT_THRESHOLD:
        direction = "below" if deviation_ratio > 0 else "above"
        return "needs_attention", f"Word drifts {pct}% {direction} the baseline"
    return "normal", f"Word baseline alignment is consistent ({pct}% deviation)"


def evaluate_word_gap(gap_ratio: float) -> tuple[Severity, str]:
    ratio = round(gap_ratio, 1)
    if gap_ratio > WORD_GAP_MAX_RATIO:
        return "needs_attention", f"Word spacing is noticeably wide ({ratio}× midline height)"
    if gap_ratio < WORD_GAP_MIN_RATIO:
        return "needs_attention", f"Word spacing is tight ({ratio}× midline height)"
    return "normal", f"Word spacing is well-proportioned ({ratio}× midline height)"


def evaluate_size_consistency(size_ratio: float) -> tuple[Severity, str]:
    ratio = round(size_ratio, 2)
    if size_ratio > SIZE_RATIO_MAX:
        return "needs_attention", f"Letters exceed expected midline height ({ratio}×)"
    if size_ratio < SIZE_RATIO_MIN:
        return "needs_attention", f"Letters are smaller than midline height ({ratio}×)"
    return "normal", f"Letter size is consistent with guideline height ({ratio}×)"


def evaluate_slant(slant_deg: float, bbox: list[int]) -> tuple[Severity, list[int], str]:
    x, y, w, h = bbox
    cx = x + w // 2
    cy = y + h // 2

    rad = math.radians(slant_deg)
    length = max(20, h // 2)
    dx = int(length * math.sin(rad))
    dy = int(length * math.cos(rad))

    vector = [cx - dx, cy + dy, cx + dx, cy - dy]
    angle = round(slant_deg, 1)

    if slant_deg > SLANT_MAX_DEG:
        return "needs_attention", vector, f"Steep forward slant ({angle}°)"
    if slant_deg < SLANT_MIN_DEG:
        return "needs_attention", vector, f"Backward slant ({angle}°)"
    return "normal", vector, f"Standard cursive slant ({angle}°)"


def evaluate_letter_formation(score: float | None) -> tuple[Severity, str, str]:
    if score is None:
        score = 65.0

    rounded = round(score, 1)
    if score >= 85.0:
        return "normal", "excellent", f"Excellent formation ({rounded}/100)"
    if score >= 62.5:
        return "normal", "satisfactory", f"Satisfactory formation ({rounded}/100)"
    if score >= 35.0:
        return (
            "needs_attention",
            "developing",
            f"Developing formation ({rounded}/100) — practice stroke loops",
        )
    return (
        "needs_attention",
        "needs_improvement",
        f"Needs improvement ({rounded}/100) — guided tracing recommended",
    )
