import numpy as np

from app.cv.tracing import (
    extract_stroke_svg_paths,
    morphological_skeleton,
    segment_word_letter_zones,
)


def test_morphological_skeleton_basic():
    # 5x5 image with a cross in the center
    img = np.zeros((7, 7), dtype=np.uint8)
    img[1:6, 3] = 255
    img[3, 1:6] = 255

    skel = morphological_skeleton(img)
    assert skel is not None
    assert skel.shape == img.shape
    assert np.any(skel > 0)


def test_extract_stroke_svg_paths_empty():
    assert extract_stroke_svg_paths(np.zeros((0, 0), dtype=np.uint8), [0, 0, 100, 50]) == []


def test_extract_stroke_svg_paths_valid():
    img = np.zeros((40, 100), dtype=np.uint8)
    # Draw a diagonal line simulating a pen stroke
    for i in range(5, 35):
        img[i, i * 2] = 255
        img[i, i * 2 + 1] = 255

    paths = extract_stroke_svg_paths(img, [100, 200, 200, 80])
    assert isinstance(paths, list)
    assert len(paths) > 0
    assert paths[0].startswith("M ")
    assert "L " in paths[0]


def test_segment_word_letter_zones():
    img = np.zeros((40, 120), dtype=np.uint8)
    img[10:30, 10:110] = 255

    zones = segment_word_letter_zones(img, [50, 100, 200, 50], expected_text="cat")
    assert len(zones) == 3
    assert zones[0].char == "c"
    assert zones[1].char == "a"
    assert zones[2].char == "t"
    assert zones[0].bbox[0] >= 50


def test_suppress_guidelines_preserving_strokes():
    from app.cv.tracing import suppress_guidelines_preserving_strokes

    img = np.zeros((40, 100), dtype=np.uint8)
    # Horizontal guideline across row y=20 (canvas y=220, bbox y0=200)
    img[20, :] = 255
    # Vertical stroke crossing guideline at x=50 (y from 5 to 35)
    img[5:35, 50] = 255

    cleaned = suppress_guidelines_preserving_strokes(img, [100, 200, 100, 40], guideline_ys=[220])

    # Isolated horizontal guideline at x=10 should be removed (0)
    assert cleaned[20, 10] == 0
    # Crossing vertical stroke at x=50 should be preserved (255)
    assert cleaned[20, 50] == 255
    assert cleaned[10, 50] == 255


def test_extract_stroke_svg_paths_with_guideline_suppression():
    img = np.zeros((40, 100), dtype=np.uint8)
    # Horizontal guideline across row y=20 (canvas y=220, bbox y0=200)
    img[20, :] = 255
    # Vertical stroke crossing guideline at x=50 (y from 5 to 35)
    img[5:35, 50] = 255

    paths = extract_stroke_svg_paths(img, [100, 200, 100, 40], guideline_ys=[220])
    # Should extract stroke paths (for vertical stroke) but not a long horizontal path
    assert isinstance(paths, list)
    # Ensure no path spans across the full width x=0 to x=99 at y=220
    for p in paths:
        assert "M 100 220 L 199 220" not in p

