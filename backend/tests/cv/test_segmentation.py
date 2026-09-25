"""Tests for CV Pipeline §5: Line & Word Segmentation and Post-Segmentation Gate."""

import pytest

from app.cv.guide_lines import detect_and_deskew
from app.cv.preprocessing import preprocess
from app.cv.segmentation import (
    PostSegmentationRejection,
    segment_lines_and_words,
    validate_segmentation,
)
from tests.synthetic import (
    make_segmented_worksheet,
)


def test_segment_lines_and_words_structure():
    """Verify clean line bands, word counts, and bounding box extraction."""
    # 2 lines, 3 words per line, 4 letter strokes per word
    img_bytes = make_segmented_worksheet(
        num_lines=2,
        words_per_line=3,
        letters_per_word=4,
        letter_width=25,
        letter_gap=12,
        word_gap=70,
    )

    preprocessed = preprocess(img_bytes)
    deskewed = detect_and_deskew(preprocessed)

    result = segment_lines_and_words(deskewed)

    assert result.total_word_count == 6
    assert len(result.lines) == 2

    for line in result.lines:
        assert len(line.words) == 3
        assert len(line.word_gaps) == 2
        assert len(line.raw_word_gaps) == 2
        # Verify word gaps are clearly larger than intra-word gaps
        for word_gap in line.raw_word_gaps:
            assert word_gap >= 50

        for word in line.words:
            x, y, w, h = word.bbox
            assert w > 50
            assert h > 20
            assert word.gray_crop.shape == (h, w)
            assert word.binary_crop.shape == (h, w)
            # 4 letter strokes -> 3 intra-word gaps
            assert len(word.raw_intra_word_gaps) == 3
            for intra_gap in word.raw_intra_word_gaps:
                assert intra_gap < 30


def test_post_segmentation_gate_pass():
    """Post-segmentation gate succeeds when detected words match expected words."""
    img_bytes = make_segmented_worksheet(num_lines=2, words_per_line=3)
    preprocessed = preprocess(img_bytes)
    deskewed = detect_and_deskew(preprocessed)

    # Exact match
    result = segment_lines_and_words(deskewed, expected_word_count=6)
    assert result.total_word_count == 6

    # Within tolerance (expected 5 or 7 with detected 6)
    result_tolerated = segment_lines_and_words(deskewed, expected_word_count=5)
    assert result_tolerated.total_word_count == 6


def test_post_segmentation_gate_mismatch_too_few():
    """Post-segmentation gate rejects if detected words are far below expected."""
    img_bytes = make_segmented_worksheet(num_lines=1, words_per_line=2)
    preprocessed = preprocess(img_bytes)
    deskewed = detect_and_deskew(preprocessed)

    with pytest.raises(PostSegmentationRejection) as exc_info:
        segment_lines_and_words(deskewed, expected_word_count=10)

    err = exc_info.value
    assert err.code == "SEGMENTATION_COUNT_MISMATCH"
    assert err.detected_words == 2
    assert err.expected_words == 10


def test_post_segmentation_gate_mismatch_too_many():
    """Post-segmentation gate rejects if detected words are far above expected."""
    img_bytes = make_segmented_worksheet(num_lines=3, words_per_line=4)
    preprocessed = preprocess(img_bytes)
    deskewed = detect_and_deskew(preprocessed)

    with pytest.raises(PostSegmentationRejection) as exc_info:
        segment_lines_and_words(deskewed, expected_word_count=2)

    err = exc_info.value
    assert err.code == "SEGMENTATION_COUNT_MISMATCH"
    assert err.detected_words == 12
    assert err.expected_words == 2


def test_post_segmentation_gate_zero_words():
    """Post-segmentation gate rejects if no words detected when some were expected."""
    # 3-line ruling without any handwriting ink
    img_bytes = make_segmented_worksheet(num_lines=2, words_per_line=0)
    preprocessed = preprocess(img_bytes)
    deskewed = detect_and_deskew(preprocessed)

    # Validate end-to-end rejection on empty text
    with pytest.raises(PostSegmentationRejection) as exc_info:
        segment_lines_and_words(deskewed, expected_word_count=5)

    err = exc_info.value
    assert err.code == "SEGMENTATION_COUNT_MISMATCH"
    assert err.detected_words == 0
    assert err.expected_words == 5


def test_single_word_per_line():
    """Single word per line produces 0 word gaps and 1 WordSegment."""
    img_bytes = make_segmented_worksheet(num_lines=1, words_per_line=1, letters_per_word=3)
    preprocessed = preprocess(img_bytes)
    deskewed = detect_and_deskew(preprocessed)

    result = segment_lines_and_words(deskewed, expected_word_count=1)
    assert result.total_word_count == 1
    assert len(result.lines) == 1
    assert len(result.lines[0].words) == 1
    assert result.lines[0].word_gaps == []
    assert len(result.lines[0].words[0].intra_word_gaps) == 2


def test_empty_rulings_result():
    """When no rulings are detected, segmentation returns 0 words without crashing."""
    img_bytes = make_segmented_worksheet(num_lines=1, words_per_line=1)
    preprocessed = preprocess(img_bytes)
    deskewed = detect_and_deskew(preprocessed)
    # Clear rulings
    deskewed.baseline_y = []
    deskewed.midline_y = []
    deskewed.topline_y = []

    result = segment_lines_and_words(deskewed)
    assert result.total_word_count == 0
    assert result.lines == []


def test_validate_segmentation_edge_cases():
    """Test validation boundaries and no-op on non-positive expected count."""
    # Should not raise for expected <= 0
    validate_segmentation(0, 0)
    validate_segmentation(5, -1)

    # Within valid ratio [0.5, 2.5]
    validate_segmentation(5, 10)  # ceil(10 * 0.5) = 5
    validate_segmentation(25, 10)  # ceil(10 * 2.5) = 25

    # Out of range
    with pytest.raises(PostSegmentationRejection):
        validate_segmentation(26, 10)


def test_rejects_full_width_line_artifacts():
    """A continuous line spanning the entire width must not be accepted as a word."""
    import numpy as np

    from app.cv.guide_lines import DeskewResult

    h, w = 2000, 2000
    binary = np.zeros((h, w), dtype=np.uint8)
    # Draw a line spanning across the entire width inside row band
    binary[540:560, :] = 255

    deskew = DeskewResult(
        gray=binary,
        denoised=binary,
        binary=binary,
        topline_y=[450],
        midline_y=[500],
        baseline_y=[550],
        deskew_angle=0.0,
    )

    result = segment_lines_and_words(deskew, expected_word_count=None)
    # The full-width artifact must NOT be accepted as a valid word
    assert result.total_word_count == 0


def test_segment_lines_and_words_rejects_vertical_margin_and_empty_rulings():
    """Verify empty ruling bands and vertical margin lines do not produce false words."""
    import cv2
    import numpy as np

    from app.cv.guide_lines import DeskewResult

    h, w = 3000, 2400
    binary = np.zeros((h, w), dtype=np.uint8)

    # 3 rulings (0: empty, 1: contains 1 real word + margin line, 2: empty)
    toplines = [600, 1200, 1800]
    midlines = [800, 1400, 2000]
    baselines = [1000, 1600, 2200]

    # Draw vertical red margin line at x=300 down the whole page
    cv2.line(binary, (300, 400), (300, 2400), 255, thickness=4)

    # Draw 1 real cursive-like word on ruling 1 (x=600 to 1100, y=1350 to 1600)
    for x in range(600, 1100, 15):
        cv2.line(binary, (x, 1380), (x + 10, 1590), 255, thickness=4)

    deskew = DeskewResult(
        gray=binary,
        denoised=binary,
        binary=binary,
        topline_y=toplines,
        midline_y=midlines,
        baseline_y=baselines,
        deskew_angle=0.0,
    )

    result = segment_lines_and_words(deskew, expected_word_count=1)
    assert result.total_word_count == 1
    assert len(result.lines[1].words) == 1
    assert result.lines[0].words == []
    assert result.lines[2].words == []


def test_continuous_ruling_preserves_descenders_without_ghost_words():
    """On continuous ruled paper where base_y[i] == topline_y[i+1], descenders
    must remain attached to row i and must not spawn false words on empty row i+1.
    """
    import cv2
    import numpy as np

    from app.cv.guide_lines import DeskewResult

    h, w = 2000, 2000
    binary = np.zeros((h, w), dtype=np.uint8)

    # 2 continuous rulings:
    # Row 0: top=400, mid=500, base=600
    # Row 1: top=600, mid=700, base=800 (empty row)
    toplines = [400, 600]
    midlines = [500, 700]
    baselines = [600, 800]

    # Draw word 'quick' on Row 0:
    # Body between 490 and 605
    # Letter 'q' has descender extending down to y=685 (inside Row 1 ascender space, above Row 1 midline 700)
    for x in range(300, 700, 15):
        cv2.line(binary, (x, 505), (x + 8, 602), 255, thickness=4)
    # Descender stroke at x=330 down to y=685:
    cv2.line(binary, (330, 602), (330, 685), 255, thickness=4)

    deskew = DeskewResult(
        gray=binary,
        denoised=binary,
        binary=binary,
        topline_y=toplines,
        midline_y=midlines,
        baseline_y=baselines,
        deskew_angle=0.0,
    )

    result = segment_lines_and_words(deskew, expected_word_count=1)

    assert result.total_word_count == 1
    assert len(result.lines[0].words) == 1
    assert len(result.lines[1].words) == 0

    word = result.lines[0].words[0]
    bx, by, bw, bh = word.bbox
    # Bounding box must encompass the descender (reaching beyond y=675)
    assert by + bh >= 680

