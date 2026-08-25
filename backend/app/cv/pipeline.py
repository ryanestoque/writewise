"""CV Pipeline Orchestrator (CV_PIPELINE.md §9).

Executes Stages 1 through 6 synchronously on an input worksheet image and returns
both structured measurement data and CNN handoff word crops.
"""

from dataclasses import dataclass
from typing import List, Optional

import numpy as np

from app.cv.features import extract_features
from app.cv.guide_lines import detect_and_deskew
from app.cv.models import MeasurementData
from app.cv.preprocessing import preprocess
from app.cv.quality_gate import run_quality_gate
from app.cv.segmentation import segment_lines_and_words


@dataclass
class CVPipelineResult:
    """Output of the complete CV pipeline."""

    measurement: MeasurementData
    word_crops: List[np.ndarray]  # Deskewed grayscale crops for CNN (§7)


def run_cv_pipeline(
    image_bytes: bytes,
    expected_word_count: Optional[int] = None,
) -> CVPipelineResult:
    """Execute the full CV feature extraction pipeline.

    Parameters
    ----------
    image_bytes : bytes
        Validated, EXIF-stripped JPEG image bytes.
    expected_word_count : Optional[int]
        Target text word count for the post-segmentation gate check (§5.3).

    Returns
    -------
    CVPipelineResult
        Structured measurements and grayscale word crops.

    Raises
    ------
    QualityGateRejection
        If image fails blur, brightness, contrast, or resolution checks.
    PostSegmentationRejection
        If detected word count deviates significantly from expected count.
    """
    # 1. Stage 1: Quality Gate
    run_quality_gate(image_bytes)

    # 2. Stage 2: Preprocessing
    prep = preprocess(image_bytes)

    # 3. Stage 3: Guide-Line Detection & Deskew
    deskew = detect_and_deskew(prep)

    # 4. Stage 4: Segmentation & Post-Segmentation Gate
    segmentation = segment_lines_and_words(
        deskew=deskew,
        expected_word_count=expected_word_count,
    )

    # 5. Stage 5: Feature Extraction & Output Assembly
    measurement = extract_features(segmentation, deskew)

    # Collect grayscale crops for CNN handoff (§7)
    word_crops: List[np.ndarray] = []
    for line in segmentation.lines:
        for word in line.words:
            word_crops.append(word.gray_crop)

    return CVPipelineResult(
        measurement=measurement,
        word_crops=word_crops,
    )
