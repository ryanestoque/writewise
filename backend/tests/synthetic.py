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