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
    make_printed_worksheet,
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


def test_post_segmentation_gate_single_word_strict_rejection():
    """Post-segmentation gate rejects multi-word detection when 1 word is expected."""
    img_bytes = make_segmented_worksheet(num_lines=1, words_per_line=2)
    preprocessed = preprocess(img_bytes)
    deskewed = detect_and_deskew(preprocessed)

    with pytest.raises(PostSegmentationRejection) as exc_info:
        segment_lines_and_words(deskewed, expected_word_count=1)

    err = exc_info.value
    assert err.code == "SEGMENTATION_COUNT_MISMATCH"
    assert err.detected_words == 2
    assert err.expected_words == 1


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
    """When no rulings are detected, segmentation returns 0 words when unguided,
    or raises QUALITY_GATE_NO_GUIDELINES when guidelines validation is enabled.
    """
    img_bytes = make_segmented_worksheet(num_lines=1, words_per_line=1)
    preprocessed = preprocess(img_bytes)
    deskewed = detect_and_deskew(preprocessed)
    # Clear rulings
    deskewed.baseline_y = []
    deskewed.midline_y = []
    deskewed.topline_y = []

    result = segment_lines_and_words(deskewed, validate_guidelines=False)
    assert result.total_word_count == 0
    assert result.lines == []

    with pytest.raises(PostSegmentationRejection) as exc_info:
        segment_lines_and_words(deskewed, validate_guidelines=True)
    assert exc_info.value.code == "QUALITY_GATE_NO_GUIDELINES"


def test_validate_segmentation_edge_cases():
    """Test validation boundaries and no-op on non-positive expected count."""
    # Should not raise for expected <= 0
    validate_segmentation(0, 0)
    validate_segmentation(5, -1)

    # N=4 prompt ("the quick brown fox"):
    # 2 words ("the quick") must be rejected as incomplete
    with pytest.raises(PostSegmentationRejection) as exc_info:
        validate_segmentation(detected_words=2, expected_words=4)
    assert exc_info.value.code == "SEGMENTATION_COUNT_MISMATCH"
    assert exc_info.value.detected_words == 2
    assert exc_info.value.expected_words == 4

    # 3, 4, 5 words for N=4 are allowed
    validate_segmentation(3, 4)
    validate_segmentation(4, 4)
    validate_segmentation(5, 4)

    # 6+ words for N=4 must be rejected
    with pytest.raises(PostSegmentationRejection):
        validate_segmentation(6, 4)

    # N=2 prompt: 1 word must be rejected (50% incomplete)
    with pytest.raises(PostSegmentationRejection):
        validate_segmentation(1, 2)
    validate_segmentation(2, 2)
    validate_segmentation(3, 2)

    # N=10 prompt: [8, 13] allowed, outside rejected
    validate_segmentation(8, 10)
    validate_segmentation(10, 10)
    validate_segmentation(13, 10)
    with pytest.raises(PostSegmentationRejection):
        validate_segmentation(7, 10)
    with pytest.raises(PostSegmentationRejection):
        validate_segmentation(14, 10)


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
    cv2.line(binary, (600, 1550), (1100, 1550), 255, thickness=4)

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
    # Letter 'q' descender extends to y=685 (Row 1 ascender space, above Row 1 mid 700)
    for x in range(300, 700, 15):
        cv2.line(binary, (x, 505), (x + 8, 602), 255, thickness=4)
    # Descender stroke at x=330 down to y=685:
    cv2.line(binary, (330, 602), (330, 685), 255, thickness=4)
    # Cursive connecting stroke:
    cv2.line(binary, (300, 580), (700, 580), 255, thickness=4)

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


def test_printed_worksheet_rejected_with_script_code():
    """Worksheets with printed (disconnected) handwriting are rejected at post-segmentation."""
    img_bytes = make_printed_worksheet(num_lines=2, words_per_line=3)
    preprocessed = preprocess(img_bytes)
    deskewed = detect_and_deskew(preprocessed)

    with pytest.raises(PostSegmentationRejection) as exc_info:
        segment_lines_and_words(deskewed, expected_word_count=6)

    assert exc_info.value.code == "QUALITY_GATE_SCRIPT_NOT_CURSIVE"
    assert "printed rather than cursive" in exc_info.value.message


def test_cursive_worksheet_passes_script_validation():
    """Worksheets with cursive ligatures pass post-segmentation script validation."""
    img_bytes = make_segmented_worksheet(num_lines=2, words_per_line=3, with_ligatures=True)
    preprocessed = preprocess(img_bytes)
    deskewed = detect_and_deskew(preprocessed)

    result = segment_lines_and_words(deskewed, expected_word_count=6)
    assert result.total_word_count == 6


def test_cursive_intra_word_letter_gaps_not_oversegmented():
    """When cursive words have small stroke fissures and letter connector gaps (~0.5x unit height),
    they must not be split into separate words if a clear larger word gap exists.
    """
    import cv2
    import numpy as np

    from app.cv.guide_lines import DeskewResult

    h, w = 1200, 1600
    binary = np.zeros((h, w), dtype=np.uint8)
    top_y, mid_y, base_y = 300, 360, 420

    # Draw 3 guide lines
    cv2.line(binary, (50, top_y), (w - 50, top_y), 255, thickness=2)
    cv2.line(binary, (50, mid_y), (w - 50, mid_y), 255, thickness=2)
    cv2.line(binary, (50, base_y), (w - 50, base_y), 255, thickness=2)

    # Draw 2 cursive words with letter stems and realistic small fissures:
    # Word 1: stems at x=100, 145, 190 (intra-word letter gap = 30px, ~0.50x unit_h)
    # Plus tiny 2px stroke fissure at x=107 and x=152 (which collapses median_gap to ~2px)
    # Word Gap: 120px (~2.00x unit_h) -> next word starts at x=325
    # Word 2: stems at x=325, 370, 415 (intra-word letter gap = 30px, ~0.50x unit_h)
    for stem_x in [100, 145, 190, 325, 370, 415]:
        cv2.rectangle(binary, (stem_x, mid_y + 5), (stem_x + 6, base_y - 2), 255, thickness=-1)
        # 2px fissure
        cv2.rectangle(binary, (stem_x + 9, mid_y + 5), (stem_x + 15, base_y - 2), 255, thickness=-1)

    deskew = DeskewResult(
        gray=255 - binary,
        denoised=255 - binary,
        binary=binary,
        topline_y=[top_y],
        midline_y=[mid_y],
        baseline_y=[base_y],
        deskew_angle=0.0,
    )

    result = segment_lines_and_words(deskew, expected_word_count=2, validate_script=False)
    assert result.total_word_count == 2
    assert len(result.lines[0].words) == 2
    assert len(result.lines[0].word_gaps) == 1


def test_non_continuous_ruling_preserves_descenders():
    """On standard ruled paper with interline gap (next_top > base_y), descenders
    like 'g' or 'y' must not be truncated at (base_y + next_top) // 2.
    """
    import cv2
    import numpy as np

    from app.cv.guide_lines import DeskewResult

    h, w = 1200, 1200
    binary = np.zeros((h, w), dtype=np.uint8)

    # 2 rulings with interline space:
    # Row 0: top=200, mid=260, base=320 (unit_height = 60, line_height = 120)
    # Interline gap between base_y=320 and next_top=360 is 40px
    # Row 1: top=360, mid=420, base=480 (empty)
    toplines = [200, 360]
    midlines = [260, 420]
    baselines = [320, 480]

    # Draw word 'joy' on Row 0:
    # Core body between y=262 and y=318 from x=200 to x=350
    for x in range(200, 350, 10):
        cv2.line(binary, (x, 265), (x + 6, 318), 255, thickness=3)
    # Descender for 'y' extending down to y=380 (60px below baseline, past next_top 360)
    cv2.line(binary, (330, 318), (330, 380), 255, thickness=4)

    deskew = DeskewResult(
        gray=binary,
        denoised=binary,
        binary=binary,
        topline_y=toplines,
        midline_y=midlines,
        baseline_y=baselines,
        deskew_angle=0.0,
    )

    result = segment_lines_and_words(deskew, expected_word_count=1, validate_script=False)

    assert result.total_word_count == 1
    assert len(result.lines[0].words) == 1
    word = result.lines[0].words[0]
    bx, by, bw, bh = word.bbox
    # Descender reached y=380; bounding box must not be clamped at (320+360)//2 = 340
    assert (by + bh) >= 375, f"Word bbox bottom {by + bh} severed descender extending to 380"

