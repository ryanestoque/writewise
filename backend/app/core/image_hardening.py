import io

from fastapi import HTTPException, status
from PIL import Image

# JPEG: FF D8 FF
_JPEG_MAGIC = b"\xff\xd8\xff"
# PNG: 89 50 4E 47 0D 0A 1A 0A
_PNG_MAGIC = b"\x89PNG\r\n\x1a\n"

# Pillow's default — ~178 megapixels. Protects against decompression bombs
# where a small file decodes into an enormous in-memory bitmap (SECURITY §4.2).
_MAX_PIXELS = 178_956_970


def _check_magic_bytes(file_bytes: bytes) -> str:
    """
    Verify file signature matches JPEG or PNG.
    Returns the detected format ('JPEG' or 'PNG').
    Raises HTTPException with UNSUPPORTED_FILE_TYPE if neither.
    """
    if len(file_bytes) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "UNSUPPORTED_FILE_TYPE",
                "message": "File is not a supported image type. Please upload a JPEG or PNG.",
                "details": {},
            },
        )

    if file_bytes[:3] == _JPEG_MAGIC:
        return "JPEG"
    if file_bytes[:8] == _PNG_MAGIC:
        return "PNG"

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={
            "code": "UNSUPPORTED_FILE_TYPE",
            "message": "File is not a supported image type. Please upload a JPEG or PNG.",
            "details": {},
        },
    )


def validate_and_harden_image(file_bytes: bytes) -> bytes:
    """
    Run all three security checks (SECURITY §4) and return hardened JPEG bytes.

    1. Magic-byte file-signature validation (before Pillow touches the file)
    2. Decompression-bomb pixel-dimension cap (at decode time)
    3. Unconditional EXIF metadata stripping (GPS, timestamps, device info)

    PNG inputs are converted to JPEG. Output is always clean JPEG bytes
    with no EXIF data, ready for Storage upload.

    Raises:
        HTTPException(400, UNSUPPORTED_FILE_TYPE) — not JPEG/PNG
        HTTPException(400, FILE_TOO_LARGE) — pixel dimensions exceed cap
    """
    # Check 1: Magic bytes — runs BEFORE Pillow touches the file (AGENTS.md §6 rule 5)
    _check_magic_bytes(file_bytes)

    # Check 2: Decompression-bomb cap — set before Image.open()
    Image.MAX_IMAGE_PIXELS = _MAX_PIXELS
    try:
        img = Image.open(io.BytesIO(file_bytes))
        img.load()  # Force full decode to trigger DecompressionBombError
    except Image.DecompressionBombError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "FILE_TOO_LARGE",
                "message": "Image dimensions are too large to process safely.",
                "details": {},
            },
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "UNSUPPORTED_FILE_TYPE",
                "message": (
                    "File could not be decoded as an image. Please upload a valid JPEG or PNG."
                ),
                "details": {},
            },
        )

    # Check 3: Unconditional EXIF strip — re-save as JPEG with no metadata.
    # Convert RGBA (PNG with transparency) to RGB for JPEG compatibility.
    if img.mode in ("RGBA", "P", "LA"):
        img = img.convert("RGB")
    elif img.mode != "RGB":
        img = img.convert("RGB")

    output = io.BytesIO()
    img.save(output, format="JPEG", quality=95, exif=b"")
    return output.getvalue()
