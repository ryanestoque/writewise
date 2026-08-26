"""CV Pipeline §3: Preprocessing — grayscale, denoise, Otsu threshold.

Runs on every image that clears the quality gate.  Each step is
deliberately simple and uses OpenCV defaults/well-known approaches:

1. Grayscale conversion
2. Median blur (preserves edges better than Gaussian — downstream
   thresholding and line/contour detection need sharp stroke edges)
3. Otsu's method binarization (auto-picks the cutoff from each image's
   own histogram rather than a fixed value, handling varying
   lighting/exposure across phones and classrooms)

Deskew is NOT part of this stage — it depends on guide-line detection
(§4) running first.
"""

from dataclasses import dataclass

import cv2
import numpy as np


@dataclass
class PreprocessResult:
    """Output of the preprocessing stage.

    Downstream stages need different representations:
    - ``gray``: guide-line detection, CNN handoff crops (§7)
    - ``denoised``: intermediate — available for debugging/inspection
    - ``binary``: guide-line detection (§4), segmentation (§5),
      feature extraction (§6) — all operate on binarized images
    - ``otsu_threshold``: the threshold value Otsu auto-selected;
      useful for logging/diagnostics, not consumed by later stages
    """

    gray: np.ndarray  # Single-channel uint8, same HxW as input
    denoised: np.ndarray  # After median blur, single-channel uint8
    binary: np.ndarray  # After Otsu threshold — 0 (background) or 255 (ink)
    otsu_threshold: float  # The binarization cutoff Otsu chose


# Median blur kernel size — must be odd.  3×3 is the smallest useful
# kernel: removes salt-and-pepper noise from phone camera images without
# softening stroke edges that thresholding depends on.
_MEDIAN_KSIZE = 3


def preprocess(image_bytes: bytes) -> PreprocessResult:
    """Run CV_PIPELINE §3 preprocessing on raw image bytes.

    Parameters
    ----------
    image_bytes : bytes
        Raw JPEG/PNG bytes (same format the quality gate accepts).

    Returns
    -------
    PreprocessResult
        Grayscale, denoised, and binarized images plus the Otsu
        threshold value.

    Raises
    ------
    ValueError
        If *image_bytes* cannot be decoded into a valid image.
    """
    # Decode
    array = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Could not decode image bytes.")

    # 1. Grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # 2. Denoise — median blur, edge-preserving
    denoised = cv2.medianBlur(gray, _MEDIAN_KSIZE)

    # 3. Otsu threshold — THRESH_BINARY_INV so ink pixels = 255,
    #    background = 0.  This is what cv2.findContours,
    #    cv2.HoughLinesP, and column projection profiles expect
    #    (white foreground on black background).
    otsu_thresh, binary = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    return PreprocessResult(
        gray=gray,
        denoised=denoised,
        binary=binary,
        otsu_threshold=float(otsu_thresh),
    )
