"""Synthetic, programmatically-generated test images with known ground truth.

Shared by all CV pipeline test modules (TESTING §4.1). No fixture files are
committed — every image is generated at test-run time.
"""

import cv2
import numpy as np

# Tuned so each generator's JPEG-encoded output sits clearly on the correct
# side of quality_gate.py's thresholds (RESOLUTION_MIN_SHORT_SIDE=1500,
# BLUR_VARIANCE_MIN=100.0, BRIGHTNESS range 50-200, CONTRAST_STD_MIN=20.0).
_SHARP_BG = 190
_SHARP_INK = 30
_DARK_BG = 20
_DARK_INK = 255
_BRIGHT_BG = 240
_BRIGHT_INK = 0
_LOW_CONTRAST_BG = 140
_LOW_CONTRAST_INK = 125
_LOW_CONTRAST_CELL = 6  # checkerboard cell size in px


def _base_worksheet(width, height, bg_value, ink_value, n_lines=8, rng_seed=42, density=15000):
    """White-ish background with printed guide lines + scattered dark
    rectangles simulating writing. `density` controls stroke count
    (n_strokes = area / density) — lower density means more, smaller strokes.
    """
    rng = np.random.default_rng(rng_seed)
    img = np.full((height, width), bg_value, dtype=np.uint8)

    line_gap = height // (n_lines + 1)
    for i in range(1, n_lines + 1):
        y = i * line_gap
        cv2.line(img, (0, y), (width, y), int(bg_value * 0.85), thickness=2)

    n_strokes = max(20, (width * height) // density)
    for _ in range(n_strokes):
        y_line = rng.integers(1, n_lines + 1) * line_gap
        x = rng.integers(0, max(1, width - 60))
        w = rng.integers(15, 45)
        h = rng.integers(20, 55)
        y = max(0, y_line - h)
        cv2.rectangle(img, (x, y), (x + w, y_line), ink_value, thickness=-1)

    return img


def make_sharp_worksheet(width: int = 2000, height: int = 2600) -> bytes:
    """
    Generate a synthetic worksheet image that passes all quality checks.
    White background with dark guide lines and simple shapes simulating
    writing. Returns JPEG bytes.
    """
    img = _base_worksheet(width, height, bg_value=_SHARP_BG, ink_value=_SHARP_INK)
    _, buf = cv2.imencode(".jpg", img)
    return buf.tobytes()


def make_blurry_image(width: int = 2000, height: int = 2600) -> bytes:
    """Generate an image with Laplacian variance below the blur threshold."""
    img = _base_worksheet(width, height, bg_value=_SHARP_BG, ink_value=_SHARP_INK)
    img = cv2.GaussianBlur(img, (61, 61), 20)
    _, buf = cv2.imencode(".jpg", img)
    return buf.tobytes()


def make_dark_image(width: int = 2000, height: int = 2600) -> bytes:
    """Generate an image with mean brightness below 50."""
    img = _base_worksheet(width, height, bg_value=_DARK_BG, ink_value=_DARK_INK)
    _, buf = cv2.imencode(".jpg", img)
    return buf.tobytes()


def make_bright_image(width: int = 2000, height: int = 2600) -> bytes:
    """Generate an image with mean brightness above 200."""
    img = _base_worksheet(width, height, bg_value=_BRIGHT_BG, ink_value=_BRIGHT_INK)
    _, buf = cv2.imencode(".jpg", img)
    return buf.tobytes()


def make_low_contrast_image(width: int = 2000, height: int = 2600) -> bytes:
    """
    Generate an image with intensity std dev below 20.

    Uses a fine checkerboard (every pixel borders an edge, so Laplacian
    variance stays high) between two close gray values (so population std
    stays low) — this is what makes it fail contrast specifically, without
    also tripping the blur check first.
    """
    img = np.full((height, width), _LOW_CONTRAST_BG, dtype=np.uint8)
    yy, xx = np.mgrid[0:height, 0:width]
    checker = ((xx // _LOW_CONTRAST_CELL) + (yy // _LOW_CONTRAST_CELL)) % 2 == 0
    img[checker] = _LOW_CONTRAST_INK
    _, buf = cv2.imencode(".jpg", img)
    return buf.tobytes()


def make_small_image(width: int = 800, height: int = 600) -> bytes:
    """Generate a valid-quality image whose shorter side is below 1500px."""
    img = _base_worksheet(width, height, bg_value=_SHARP_BG, ink_value=_SHARP_INK)
    _, buf = cv2.imencode(".jpg", img)
    return buf.tobytes()


def make_3line_worksheet(width: int = 2000, height: int = 2600, angle_deg: float = 0.0) -> bytes:
    """Generate a worksheet with 3-line ruling (topline, midline, baseline) and rotation.

    Simulates Grade 3 paper where each writing row has 3 printed lines.
    """
    img = np.full((height, width), _SHARP_BG, dtype=np.uint8)

    n_rows = 4
    row_gap = 400
    line_spacing = 60

    start_y = 400
    for i in range(n_rows):
        top_y = start_y + i * row_gap
        mid_y = top_y + line_spacing
        base_y = mid_y + line_spacing

        # Draw the 3 lines for this row
        cv2.line(img, (100, top_y), (width - 100, top_y), _SHARP_INK, thickness=3)
        cv2.line(img, (100, mid_y), (width - 100, mid_y), _SHARP_INK, thickness=3)
        cv2.line(img, (100, base_y), (width - 100, base_y), _SHARP_INK, thickness=3)

        # Add some ink (using _SHARP_INK)
        cv2.rectangle(img, (300, top_y + 10), (350, base_y - 10), _SHARP_INK, thickness=-1)

    if angle_deg != 0.0:
        center = (width // 2, height // 2)
        M = cv2.getRotationMatrix2D(center, angle_deg, 1.0)
        img = cv2.warpAffine(img, M, (width, height), borderValue=_SHARP_BG)

    _, buf = cv2.imencode(".jpg", img)
    return buf.tobytes()


def make_segmented_worksheet(
    width: int = 2000,
    height: int = 2600,
    num_lines: int = 2,
    words_per_line: int = 3,
    letters_per_word: int = 4,
    letter_width: int = 25,
    letter_gap: int = 12,
    word_gap: int = 70,
) -> bytes:
    """Generate a synthetic worksheet with known multi-word ruling for segmentation testing.

    Each word consists of vertical strokes (simulating cursive letter stems)
    separated by `letter_gap`. Words are separated by `word_gap`.
    """
    img = np.full((height, width), _SHARP_BG, dtype=np.uint8)

    row_gap = 400
    line_spacing = 60
    start_y = 400

    for line_idx in range(num_lines):
        top_y = start_y + line_idx * row_gap
        mid_y = top_y + line_spacing
        base_y = mid_y + line_spacing

        # Draw the 3 guide lines
        cv2.line(img, (100, top_y), (width - 100, top_y), _SHARP_INK, thickness=2)
        cv2.line(img, (100, mid_y), (width - 100, mid_y), _SHARP_INK, thickness=2)
        cv2.line(img, (100, base_y), (width - 100, base_y), _SHARP_INK, thickness=2)

        # Draw words
        current_x = 250
        for _ in range(words_per_line):
            for letter_idx in range(letters_per_word):
                # Draw letter stroke from near top to base
                cv2.rectangle(
                    img,
                    (current_x, top_y + 8),
                    (current_x + letter_width, base_y - 2),
                    _SHARP_INK,
                    thickness=-1,
                )
                current_x += letter_width
                if letter_idx < letters_per_word - 1:
                    current_x += letter_gap
            current_x += word_gap

    _, buf = cv2.imencode(".jpg", img)
    return buf.tobytes()
