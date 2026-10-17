import cv2
import numpy as np
import pytest

from app.cv.quality_gate import QualityGateRejection, QualityMetrics, run_quality_gate
from tests.synthetic import (
    make_blurry_image,
    make_bright_image,
    make_dark_image,
    make_low_contrast_image,
    make_segmented_worksheet,
    make_sharp_worksheet,
    make_small_image,
)


def test_quality_gate_rejection_carries_fields():
    exc = QualityGateRejection(
        code="QUALITY_GATE_BLUR",
        message="too blurry",
        measured_value=8.1,
        threshold=15.0,
    )
    assert exc.code == "QUALITY_GATE_BLUR"
    assert exc.message == "too blurry"
    assert exc.measured_value == 8.1
    assert exc.threshold == 15.0
    with pytest.raises(QualityGateRejection):
        raise exc


def test_quality_metrics_carries_fields():
    metrics = QualityMetrics(
        blur_variance=300.0,
        brightness_mean=150.0,
        contrast_std=35.0,
        resolution_short_side=2000,
    )
    assert metrics.blur_variance == 300.0
    assert metrics.resolution_short_side == 2000


def test_small_image_rejected_on_resolution():
    with pytest.raises(QualityGateRejection) as exc_info:
        run_quality_gate(make_small_image())
    assert exc_info.value.code == "QUALITY_GATE_RESOLUTION"
    assert exc_info.value.measured_value == 600.0
    assert exc_info.value.threshold == 1500.0


def test_sharp_worksheet_passes_resolution():
    # Full end-to-end pass is tested once all four checks exist (Step 19).
    # For now this only exercises resolution, so call the private helper
    # directly rather than the not-yet-complete run_quality_gate.
    import cv2
    import numpy as np

    from app.cv.quality_gate import _check_resolution

    array = np.frombuffer(make_sharp_worksheet(), dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    assert _check_resolution(image) == 2000


def test_blurry_image_rejected_on_blur():
    with pytest.raises(QualityGateRejection) as exc_info:
        run_quality_gate(make_blurry_image())
    assert exc_info.value.code == "QUALITY_GATE_BLUR"
    assert exc_info.value.threshold == 15.0


def test_dark_image_rejected_on_brightness():
    with pytest.raises(QualityGateRejection) as exc_info:
        run_quality_gate(make_dark_image())
    assert exc_info.value.code == "QUALITY_GATE_BRIGHTNESS"
    assert exc_info.value.threshold == 50.0


def test_readable_white_paper_is_not_rejected_as_overexposed():
    # This existing fixture has sharp black strokes on light paper, not lost detail.
    result = run_quality_gate(make_bright_image())
    assert result.brightness_mean > 210


def _capture_worksheet(
    *,
    paper: int = 240,
    ink: int = 90,
    blur_sigma: float = 0,
    shadow: bool = False,
    sharp_rules: bool = False,
    rotation: float = 0,
    noise: float = 0,
    dashed_midline: bool = False,
) -> bytes:
    """Known readable strokes, with capture degradation applied independently."""
    image = np.full((2200, 1600), paper, dtype=np.uint8)
    for baseline in (600, 1050, 1500):
        cv2.putText(
            image,
            "Practice cursive writing",
            (140, baseline - 8),
            cv2.FONT_HERSHEY_SCRIPT_SIMPLEX,
            2.8,
            ink,
            thickness=3,
            lineType=cv2.LINE_AA,
        )

    if blur_sigma and sharp_rules:
        image = cv2.GaussianBlur(image, (61, 61), blur_sigma)

    # Sharp printed structure must not vouch for the focus of the handwriting.
    for baseline in (600, 1050, 1500):
        for y in (baseline - 120, baseline - 60, baseline):
            if dashed_midline and y == baseline - 60:
                for x in range(80, 1520, 70):
                    cv2.line(image, (x, y), (min(x + 40, 1520), y), paper - 50, thickness=2)
            else:
                cv2.line(image, (80, y), (1520, y), max(ink, paper - 50), thickness=2)
    if blur_sigma and not sharp_rules:
        image = cv2.GaussianBlur(image, (61, 61), blur_sigma)

    if rotation:
        transform = cv2.getRotationMatrix2D((800, 1100), rotation, 1.0)
        image = cv2.warpAffine(image, transform, (1600, 2200), borderValue=paper)

    if shadow:
        illumination = np.linspace(0.55, 1.0, image.shape[1])[None, :]
        image = (image * illumination).astype(np.uint8)

    if noise:
        sensor_noise = np.random.default_rng(42).normal(0, noise, image.shape)
        image = np.clip(image.astype(float) + sensor_noise, 0, 255).astype(np.uint8)

    success, encoded = cv2.imencode(".jpg", image)
    assert success
    return encoded.tobytes()


@pytest.mark.parametrize("shadow", [False, True])
@pytest.mark.parametrize("ink", [90, 180, 225])
def test_readable_sparse_pencil_passes_under_even_and_uneven_lighting(shadow, ink):
    result = run_quality_gate(_capture_worksheet(ink=ink, shadow=shadow))
    assert isinstance(result, QualityMetrics)


@pytest.mark.parametrize("rotation", [-8, 8])
def test_readable_rotated_capture_passes(rotation):
    assert isinstance(run_quality_gate(_capture_worksheet(rotation=rotation)), QualityMetrics)


@pytest.mark.parametrize("noise", [2, 3])
@pytest.mark.parametrize("ink", [90, 180, 225])
def test_readable_writing_passes_with_mild_sensor_noise(noise, ink):
    assert isinstance(run_quality_gate(_capture_worksheet(ink=ink, noise=noise)), QualityMetrics)


@pytest.mark.parametrize("noise", [2, 3])
def test_sensor_noise_does_not_make_blurred_writing_pass(noise):
    with pytest.raises(QualityGateRejection) as exc_info:
        run_quality_gate(_capture_worksheet(paper=190, blur_sigma=9, sharp_rules=True, noise=noise))
    assert exc_info.value.code == "QUALITY_GATE_BLUR"


@pytest.mark.parametrize("rotation", [-14, -12, -8, -3, -1, 0, 1, 3, 8, 12, 14])
def test_dashed_sharp_rules_do_not_hide_blurred_handwriting(rotation):
    with pytest.raises(QualityGateRejection) as exc_info:
        run_quality_gate(
            _capture_worksheet(
                paper=190,
                blur_sigma=9,
                sharp_rules=True,
                dashed_midline=True,
                rotation=rotation,
            )
        )
    assert exc_info.value.code == "QUALITY_GATE_BLUR"


def test_rotated_sharp_rules_do_not_hide_blurred_handwriting():
    with pytest.raises(QualityGateRejection) as exc_info:
        run_quality_gate(_capture_worksheet(paper=190, blur_sigma=9, sharp_rules=True, rotation=8))
    assert exc_info.value.code == "QUALITY_GATE_BLUR"


def test_washed_out_photo_reports_brightness_instead_of_blur():
    with pytest.raises(QualityGateRejection) as exc_info:
        run_quality_gate(_capture_worksheet(paper=253, ink=249))
    assert exc_info.value.code == "QUALITY_GATE_BRIGHTNESS"


def test_low_contrast_photo_reports_contrast_instead_of_blur():
    with pytest.raises(QualityGateRejection) as exc_info:
        run_quality_gate(_capture_worksheet(paper=150, ink=146))
    assert exc_info.value.code == "QUALITY_GATE_CONTRAST"


@pytest.mark.parametrize("sharp_rules", [False, True])
def test_blurred_writing_is_rejected_even_with_sharp_rules(sharp_rules):
    with pytest.raises(QualityGateRejection) as exc_info:
        run_quality_gate(_capture_worksheet(paper=190, blur_sigma=9, sharp_rules=sharp_rules))
    assert exc_info.value.code == "QUALITY_GATE_BLUR"


def test_sharp_rulings_do_not_hide_blurred_word_shapes():
    image = cv2.imdecode(np.frombuffer(make_segmented_worksheet(), np.uint8), cv2.IMREAD_GRAYSCALE)
    blurred = cv2.GaussianBlur(image, (61, 61), 12)
    for y in (400, 460, 520, 800, 860, 920):
        cv2.line(blurred, (100, y), (1900, y), 30, thickness=2)
    success, encoded = cv2.imencode(".jpg", blurred)
    assert success

    with pytest.raises(QualityGateRejection) as exc_info:
        run_quality_gate(encoded.tobytes())
    assert exc_info.value.code == "QUALITY_GATE_BLUR"


def test_low_contrast_image_rejected_on_contrast():
    with pytest.raises(QualityGateRejection) as exc_info:
        run_quality_gate(make_low_contrast_image())
    assert exc_info.value.code == "QUALITY_GATE_CONTRAST"
    assert exc_info.value.threshold == 12.0


def test_sharp_worksheet_passes_end_to_end():
    result = run_quality_gate(make_sharp_worksheet())
    assert isinstance(result, QualityMetrics)
    assert result.resolution_short_side >= 1500
    assert result.blur_variance >= 15.0
    assert 50 <= result.brightness_mean <= 210
    assert result.contrast_std >= 12.0


def test_realistic_sparse_pencil_worksheet_passes_contrast():
    from app.cv.quality_gate import _check_contrast
    from tests.synthetic import _base_worksheet

    # Sparse strokes can be readable even when blank paper dilutes the global std.
    paper = _base_worksheet(3000, 4000, bg_value=190, ink_value=90, density=350000)
    assert _check_contrast(paper) < 12.0


def test_realistic_sparse_pencil_worksheet_passes_blur():
    """Verify that a sharp, realistic phone photo with sparse pencil writing
    (which naturally has lower global variance due to blank paper) passes blur check.
    """
    from app.cv.quality_gate import _check_blur
    from tests.synthetic import _base_worksheet

    # Simulate 12MP phone camera with sparse pencil writing
    img = _base_worksheet(3000, 4000, bg_value=190, ink_value=90, density=350000)
    variance = _check_blur(img)
    assert variance >= 15.0


def test_realistic_sparse_pencil_worksheet_blurred_is_rejected():
    """Verify that an actual blurry photo of sparse writing is reliably caught."""
    import cv2

    from app.cv.quality_gate import _check_blur
    from tests.synthetic import _base_worksheet

    img = _base_worksheet(3000, 4000, bg_value=190, ink_value=90, density=350000)
    blurred = cv2.GaussianBlur(img, (25, 25), 5.0)
    with pytest.raises(QualityGateRejection) as exc_info:
        _check_blur(blurred)
    assert exc_info.value.code == "QUALITY_GATE_BLUR"
    assert exc_info.value.threshold == 15.0


def test_fail_fast_checks_resolution_first():
    # Combine multiple failure modes (small + dark + blurred); resolution
    # is checked first, so that must be the reported failure regardless
    # of what else is wrong with the image.
    import cv2
    import numpy as np

    array = np.frombuffer(make_small_image(), dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    darkened = np.clip(gray.astype(int) - 100, 0, 255).astype("uint8")
    blurred = cv2.GaussianBlur(darkened, (31, 31), 15)
    _, buf = cv2.imencode(".jpg", blurred)

    with pytest.raises(QualityGateRejection) as exc_info:
        run_quality_gate(buf.tobytes())
    assert exc_info.value.code == "QUALITY_GATE_RESOLUTION"
