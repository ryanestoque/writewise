from app.cv.features.spacing import compute_spacing_metrics
from app.cv.segmentation import LineSegment


def test_spacing_metrics_normal_distribution():
    # Line 1: word_gaps=[1.8, 2.2], intra_word_gaps=[0.3, 0.4]
    # Line 2: word_gaps=[2.0], intra_word_gaps=[0.35, 0.45]
    line1 = LineSegment(
        line_index=0,
        row_band=(0, 100),
        topline_y=20,
        midline_y=50,
        baseline_y=80,
        words=[],
        word_gaps=[1.8, 2.2],
        raw_word_gaps=[18, 22],
        intra_word_gaps=[0.3, 0.4],
    )
    line2 = LineSegment(
        line_index=1,
        row_band=(100, 200),
        topline_y=120,
        midline_y=150,
        baseline_y=180,
        words=[],
        word_gaps=[2.0],
        raw_word_gaps=[20],
        intra_word_gaps=[0.35, 0.45],
    )

    word_spacing, letter_spacing = compute_spacing_metrics([line1, line2])

    # Word gaps: [1.8, 2.2, 2.0] -> mean=2.0, std=0.20
    assert word_spacing.mean == 2.0
    assert abs(word_spacing.std - 0.20) <= 0.05

    # Letter gaps: [0.3, 0.4, 0.35, 0.45] -> mean=0.37 or 0.38, std=0.06
    assert abs(letter_spacing.mean - 0.375) <= 0.02
    assert abs(letter_spacing.std - 0.06) <= 0.02


def test_spacing_metrics_empty_or_single():
    # Empty lines -> None summaries (never 0.0)
    w_empty, l_empty = compute_spacing_metrics([])
    assert w_empty.mean is None and w_empty.std is None
    assert l_empty.mean is None and l_empty.std is None

    # Single-word line (no word gaps, but has intra-word gaps)
    line_one_word = LineSegment(
        line_index=0,
        row_band=(0, 100),
        topline_y=20,
        midline_y=50,
        baseline_y=80,
        words=[],
        word_gaps=[],
        raw_word_gaps=[],
        intra_word_gaps=[0.25, 0.35],
    )
    w_one, l_one = compute_spacing_metrics([line_one_word])
    assert w_one.mean is None and w_one.std is None
    assert l_one.mean == 0.3 and l_one.std is not None

    # Single gap
    line_single = LineSegment(
        line_index=0,
        row_band=(0, 100),
        topline_y=20,
        midline_y=50,
        baseline_y=80,
        words=[],
        word_gaps=[1.5],
        raw_word_gaps=[15],
        intra_word_gaps=[0.3],
    )
    w_single, l_single = compute_spacing_metrics([line_single])
    assert w_single.mean == 1.5 and w_single.std == 0.0
    assert l_single.mean == 0.3 and l_single.std == 0.0
