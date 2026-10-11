"""WriteWise — Reset Calibrated Scores (Revert to Phase 1).

Clears all calibrated scores from measurement rows (setting them to NULL).
This resets historical submissions back to Phase 1 mode (interactive manual rubric rating).

Usage:
    cd backend && uv run python ../research/reset_scores.py
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
logger = logging.getLogger("reset_scores")


def reset_all():
    from app.core.supabase import supabase_client

    logger.info("Resetting calibrated scores in public.measurement to NULL...")
    null_payload = {
        "letter_formation_score": None,
        "size_consistency_score": None,
        "spacing_score": None,
        "slant_score": None,
        "baseline_alignment_score": None,
    }

    res = (
        supabase_client.table("measurement")
        .select("id")
        .not_.is_("composite_score", "null")
        .execute()
    )
    measurements = res.data or []

    reset_count = 0
    for m in measurements:
        upd = (
            supabase_client.table("measurement")
            .update(null_payload)
            .eq("id", m["id"])
            .execute()
        )
        if upd.data:
            reset_count += 1

    logger.info(
        "Reset complete! %d rows cleared. Submissions are now in Phase 1 mode.",
        reset_count,
    )


if __name__ == "__main__":
    reset_all()
