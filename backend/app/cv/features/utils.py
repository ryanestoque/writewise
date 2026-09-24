"""CV Feature Extraction Utilities."""

import numpy as np


def get_ink_mask(binary_crop: np.ndarray) -> np.ndarray:
    """Return a boolean mask where True indicates ink pixels.

    Handles both:
    - Pipeline standard (THRESH_BINARY_INV): ink=255, background=0.
    - Traditional binary: ink=0, background=255.

    Uses border pixel distribution to identify background polarity.
    """
    if binary_crop.shape[0] >= 2 and binary_crop.shape[1] >= 2:
        perimeter = np.concatenate(
            [
                binary_crop[0, :],
                binary_crop[-1, :],
                binary_crop[:, 0],
                binary_crop[:, -1],
            ]
        )
        bg_is_light = bool(np.mean(perimeter > 128) > 0.5)
    else:
        bg_is_light = bool(np.mean(binary_crop > 128) > 0.5)

    if bg_is_light:
        return binary_crop < 128
    return binary_crop > 128
