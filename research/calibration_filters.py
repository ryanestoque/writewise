"""Read retained research evidence, excluding invalid worksheet returns by default."""

import csv
from pathlib import Path

INVALID_RETURN_REASONS = frozenset({"wrong_worksheet", "blurry_or_cropped", "wrong_target_text"})


def read_calibration_csv(
    csv_path: str | Path,
    *,
    include_invalid_returns: bool = False,
) -> list[dict[str, str]]:
    with Path(csv_path).open(newline="", encoding="utf-8") as handle:
        return [
            row
            for row in csv.DictReader(handle)
            if include_invalid_returns or row.get("return_reason", "") not in INVALID_RETURN_REASONS
        ]
