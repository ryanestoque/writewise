import io
import struct
import zlib

import pytest
from fastapi import HTTPException
from PIL import Image

from app.core.image_hardening import validate_and_harden_image


def _make_minimal_jpeg() -> bytes:
    """Create a minimal valid JPEG file (1x1 white pixel)."""
    buf = io.BytesIO()
    img = Image.new("RGB", (1, 1), (255, 255, 255))
    img.save(buf, format="JPEG")
    return buf.getvalue()


def _make_minimal_png() -> bytes:
    """Create a minimal valid PNG file (1x1 white pixel)."""
    buf = io.BytesIO()
    img = Image.new("RGB", (1, 1), (255, 255, 255))
    img.save(buf, format="PNG")
    return buf.getvalue()


def _make_bomb_png() -> bytes:
    """A structurally valid PNG whose IHDR claims huge dimensions."""
    png = bytearray(_make_minimal_png())
    # IHDR layout: signature (8) + length (4) + "IHDR" (4) + width (4) + height (4)
    struct.pack_into(">II", png, 16, 100_000, 100_000)
    # Recompute the IHDR CRC (covers type + data) so Pillow accepts the chunk
    crc = zlib.crc32(png[12:29]) & 0xFFFFFFFF
    struct.pack_into(">I", png, 29, crc)
    return bytes(png)


class TestMagicByteValidation:
    def test_valid_jpeg_passes(self):
        jpeg_bytes = _make_minimal_jpeg()
        result = validate_and_harden_image(jpeg_bytes)
        assert isinstance(result, bytes)
        assert len(result) > 0
        # Output should start with JPEG magic bytes
        assert result[:2] == b"\xff\xd8"

    def test_valid_png_passes_and_converts_to_jpeg(self):
        png_bytes = _make_minimal_png()
        result = validate_and_harden_image(png_bytes)
        assert isinstance(result, bytes)
        # Output should be JPEG (converted from PNG)
        assert result[:2] == b"\xff\xd8"

    def test_text_file_with_jpg_extension_rejected(self):
        fake_file = b"This is not an image file at all"
        with pytest.raises(HTTPException) as exc_info:
            validate_and_harden_image(fake_file)
        assert exc_info.value.status_code == 400
        assert exc_info.value.detail["code"] == "UNSUPPORTED_FILE_TYPE"

    def test_empty_file_rejected(self):
        with pytest.raises(HTTPException) as exc_info:
            validate_and_harden_image(b"")
        assert exc_info.value.status_code == 400
        assert exc_info.value.detail["code"] == "UNSUPPORTED_FILE_TYPE"

    def test_truncated_header_rejected(self):
        # Just the first byte of a JPEG header
        with pytest.raises(HTTPException) as exc_info:
            validate_and_harden_image(b"\xff")
        assert exc_info.value.status_code == 400
        assert exc_info.value.detail["code"] == "UNSUPPORTED_FILE_TYPE"


class TestDecompressionBomb:
    def test_oversized_dimensions_rejected(self):
        """A small file claiming huge pixel dimensions must be rejected."""
        bomb_png = _make_bomb_png()
        with pytest.raises(HTTPException) as exc_info:
            validate_and_harden_image(bomb_png)
        assert exc_info.value.status_code == 400
        assert exc_info.value.detail["code"] == "FILE_TOO_LARGE"


class TestExifStripping:
    def test_exif_gps_stripped_from_jpeg(self):
        """EXIF with GPS data must be completely removed."""
        import piexif

        # Build a JPEG with GPS EXIF data
        img = Image.new("RGB", (10, 10), (128, 128, 128))
        # Create EXIF with GPS coordinates (simulating a phone photo)
        exif_dict = {
            "GPS": {
                piexif.GPSIFD.GPSLatitude: ((14, 1), (35, 1), (0, 1)),
                piexif.GPSIFD.GPSLatitudeRef: "N",
                piexif.GPSIFD.GPSLongitude: ((121, 1), (0, 1), (0, 1)),
                piexif.GPSIFD.GPSLongitudeRef: "E",
            }
        }
        exif_bytes = piexif.dump(exif_dict)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", exif=exif_bytes)
        input_bytes = buf.getvalue()

        result = validate_and_harden_image(input_bytes)

        # Verify output has no EXIF
        result_img = Image.open(io.BytesIO(result))
        exif_data = result_img.info.get("exif", b"")
        assert exif_data == b"" or len(exif_data) == 0

    def test_jpeg_without_exif_still_works(self):
        """A JPEG with no EXIF should pass through cleanly."""
        jpeg_bytes = _make_minimal_jpeg()
        result = validate_and_harden_image(jpeg_bytes)
        assert isinstance(result, bytes)
        assert result[:2] == b"\xff\xd8"