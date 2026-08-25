import pytest

from app.cv.pipeline import CVPipelineResult, run_cv_pipeline
from app.cv.quality_gate import QualityGateRejection
from app.cv.segmentation import PostSegmentationRejection
from tests.synthetic import make_blurry_image, make_segmented_worksheet


def test_run_cv_pipeline_success():
    # Generate segmented worksheet with 2 lines, 3 words each = 6 words total
    img_bytes = make_segmented_worksheet(num_lines=2, words_per_line=3)
    result = run_cv_pipeline(img_bytes, expected_word_count=6)

    assert isinstance(result, CVPipelineResult)
    assert len(result.word_crops) == 6
    assert len(result.measurement.guide_lines.baseline_y) == 2
    assert len(result.measurement.lines) == 2
    assert result.measurement.aggregate.slant.mean >= 0.0
    assert result.measurement.aggregate.size_consistency.mean > 0.0

    # Ensure serialization to JSON dictionary works
    meas_dict = result.measurement.to_dict()
    assert "guide_lines" in meas_dict
    assert "lines" in meas_dict
    assert "aggregate" in meas_dict
    assert len(meas_dict["lines"][0]["words"]) == 3


def test_run_cv_pipeline_fails_quality_gate():
    # Blurry image should trigger QualityGateRejection at Stage 1
    blurry_bytes = make_blurry_image()
    with pytest.raises(QualityGateRejection):
        run_cv_pipeline(blurry_bytes)


def test_run_cv_pipeline_fails_post_segmentation_gate():
    # Segmented worksheet has 6 words, but asking for 100 expected words -> triggers rejection
    img_bytes = make_segmented_worksheet(num_lines=2, words_per_line=3)
    with pytest.raises(PostSegmentationRejection):
        run_cv_pipeline(img_bytes, expected_word_count=100)
