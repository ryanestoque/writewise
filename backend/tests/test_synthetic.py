import cv2
import numpy as np

from tests.synthetic import (
    make_blurry_image,
    make_bright_image,
    make_dark_image,
    make_low_contrast_image,
    make_sharp_worksheet,
    make_small_image,
)


def _decode_gray(jpeg_bytes: bytes) -> np.ndarray:
    array = np.frombuffer(jpeg_bytes, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)


def test_sharp_worksheet_passes_all_quality_properties():
    gray = _decode_gray(make_sharp_worksheet())
    assert min(gray.shape) >= 1500
    assert cv2.Laplacian(gray, cv2.CV_64F).var() >= 150
    assert 100 <= gray.mean() <= 195
    assert gray.std() >= 25


def test_blurry_image_has_low_blur_variance():
    gray = _decode_gray(make_blurry_image())
    assert cv2.Laplacian(gray, cv2.CV_64F).var() < 50


def test_dark_image_isolates_brightness_failure():
    gray = _decode_gray(make_dark_image())
    assert gray.mean() < 45
    assert cv2.Laplacian(gray, cv2.CV_64F).var() >= 100  # must still clear blur


def test_bright_image_isolates_brightness_failure():
    gray = _decode_gray(make_bright_image())
    assert gray.mean() > 205
    assert cv2.Laplacian(gray, cv2.CV_64F).var() >= 100  # must still clear blur


def test_low_contrast_image_isolates_contrast_failure():
    gray = _decode_gray(make_low_contrast_image())
    assert gray.std() < 15
    assert cv2.Laplacian(gray, cv2.CV_64F).var() >= 100  # must still clear blur
    assert 50 <= gray.mean() <= 200  # must still clear brightness


def test_small_image_isolates_resolution_failure():
    gray = _decode_gray(make_small_image())
    assert min(gray.shape) < 1500
    assert cv2.Laplacian(gray, cv2.CV_64F).var() >= 100
    assert 50 <= gray.mean() <= 200
    assert gray.std() >= 20