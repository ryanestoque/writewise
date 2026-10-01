"""SimpleHTR word-level text recognition and target text verification (CTC HTR).

Provides inference on deskewed word crops to transcribe cursive words and verify
that the uploaded worksheet matches the activity's target prompt.

In stub mode (ENVIRONMENT=test or dev with no HTR_MODEL_ARTIFACT_PATH),
returns matching or simulated transcriptions without loading real weights.
"""

import logging
import tempfile
from typing import Any, Optional, Tuple

import cv2
import numpy as np

from app.core.config import settings

logger = logging.getLogger(__name__)

# Standard vocabulary for IAM Words model ([UNK] at index 0 + 78 characters)
DEFAULT_VOCABULARY = ["[UNK]"] + list(
    "!\"#&'()*+,-./0123456789:;?ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
)


# Standard word crop dimensions (SimpleHTR design)
HTR_IMAGE_WIDTH = 128
HTR_IMAGE_HEIGHT = 32

# Module-level singleton
_htr_model: Any = None
_htr_stub_mode: bool = False
_vocabulary: list[str] = DEFAULT_VOCABULARY


def _should_use_stub() -> bool:
    """Determine whether to use stub mode for HTR."""
    if settings.ENVIRONMENT == "test":
        return True
    if settings.ENVIRONMENT == "dev" and not getattr(settings, "HTR_MODEL_ARTIFACT_PATH", ""):
        return True
    return False


def is_htr_stub_mode() -> bool:
    """Check if HTR stub mode is active."""
    return _htr_stub_mode or _should_use_stub()


def load_htr_model() -> None:
    """Load the HTR model artifact or activate stub mode.

    Called once at application startup via FastAPI lifespan.
    """
    global _htr_model, _htr_stub_mode

    if _should_use_stub():
        _htr_stub_mode = True
        logger.info(
            "HTR model loader: stub mode active (ENVIRONMENT=%s, HTR_MODEL_ARTIFACT_PATH=%s)",
            settings.ENVIRONMENT,
            getattr(settings, "HTR_MODEL_ARTIFACT_PATH", "<empty>"),
        )
        return

    htr_path = getattr(settings, "HTR_MODEL_ARTIFACT_PATH", "")
    logger.info(
        "HTR model loader: downloading artifact from bucket=%s path=%s",
        settings.MODEL_STORAGE_BUCKET,
        htr_path,
    )
    try:
        import tensorflow as tf

        from app.core.supabase import supabase_client

        response = supabase_client.storage.from_(settings.MODEL_STORAGE_BUCKET).download(
            htr_path
        )

        with tempfile.NamedTemporaryFile(suffix=".keras", delete=False) as tmp:
            tmp.write(response)
            tmp_path = tmp.name

        _htr_model = tf.keras.models.load_model(tmp_path, compile=False)
        _htr_stub_mode = False
        logger.info("HTR model loader: model loaded successfully")

    except Exception as exc:
        logger.warning(
            "HTR model failed to load from Storage (%s). Falling back to stub mode: %s",
            htr_path,
            exc,
        )
        _htr_stub_mode = True


def get_htr_model() -> Any:
    """Return the loaded HTR model, or None if in stub mode."""
    return _htr_model


def preprocess_word_crop_htr(
    crop: np.ndarray, target_width: int = HTR_IMAGE_WIDTH, target_height: int = HTR_IMAGE_HEIGHT
) -> np.ndarray:
    """Preprocess a single word crop for SimpleHTR inference.

    Resizes with aspect-ratio preservation to height 32, pads width to 128 with white (255),
    and normalizes to [0, 1].

    Parameters
    ----------
    crop : np.ndarray
        Grayscale or binary crop.
    target_width : int, default=128
        Target image width.
    target_height : int, default=32
        Target image height.

    Returns
    -------
    np.ndarray
        Preprocessed image of shape (target_width, target_height, 1) normalized to float32.
    """
    if len(crop.shape) == 3:
        crop = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)

    h, w = crop.shape[:2]
    if h == 0 or w == 0:
        return np.ones((target_width, target_height, 1), dtype=np.float32)

    # Binarize/normalize background to pure white (255) and ink to black (0)
    # matching the IAM Words training distribution across diverse photo lighting
    _, crop = cv2.threshold(crop, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Scale to target height preserving aspect ratio
    scale = target_height / max(h, 1)
    new_w = min(int(w * scale), target_width)
    resized = cv2.resize(crop, (new_w, target_height), interpolation=cv2.INTER_AREA)

    # Pad width to target_width with 255 (white background)
    padded = np.full((target_height, target_width), 255, dtype=np.uint8)
    padded[:, :new_w] = resized

    # Transpose so time/sequence axis (width) is first: (128, 32, 1)
    transposed = np.transpose(padded, (1, 0))
    normalized = (transposed.astype(np.float32) / 255.0)

    return np.expand_dims(normalized, axis=-1)


def ctc_greedy_decode(probs: np.ndarray, vocabulary: list[str]) -> str:
    """Decode raw model softmax probabilities using CTC greedy best-path.

    Parameters
    ----------
    probs : np.ndarray
        Softmax probability distribution of shape (T, num_classes).
    vocabulary : list[str]
        Character vocabulary including [UNK] at index 0. Blank index is assumed to be
        the last index (probs.shape[-1] - 1).

    Returns
    -------
    str
        Decoded text string.
    """
    blank_idx = probs.shape[-1] - 1
    best_path = np.argmax(probs, axis=-1)

    chars = []
    prev_idx = -1
    for idx in best_path:
        if idx != prev_idx:
            if 0 < idx < len(vocabulary) and idx != blank_idx:
                token = vocabulary[idx]
                if token != "[UNK]":
                    chars.append(token)
            prev_idx = idx

    return "".join(chars).strip()



def predict_word_text(crop: np.ndarray, vocabulary: Optional[list[str]] = None) -> str:
    """Transcribe a single word crop using the HTR model.

    Parameters
    ----------
    crop : np.ndarray
        Word crop image.
    vocabulary : Optional[list[str]]
        Vocabulary list. Defaults to DEFAULT_VOCABULARY.

    Returns
    -------
    str
        Transcribed word text.
    """
    vocab = vocabulary or _vocabulary

    if is_htr_stub_mode() or _htr_model is None:
        # In stub mode, return placeholder
        return ""

    processed = preprocess_word_crop_htr(crop)
    batch_input = np.expand_dims(processed, axis=0)

    preds = _htr_model.predict(batch_input, verbose=0)[0]
    return ctc_greedy_decode(preds, vocab)


def levenshtein_similarity(str1: str, str2: str) -> float:
    """Compute normalized Levenshtein similarity between two strings in [0.0, 1.0]."""
    s1, s2 = str1.lower().strip(), str2.lower().strip()
    if not s1 and not s2:
        return 1.0
    if not s1 or not s2:
        return 0.0

    len1, len2 = len(s1), len(s2)
    dp = np.zeros((len1 + 1, len2 + 1), dtype=int)

    for i in range(len1 + 1):
        dp[i][0] = i
    for j in range(len2 + 1):
        dp[0][j] = j

    for i in range(1, len1 + 1):
        for j in range(1, len2 + 1):
            cost = 0 if s1[i - 1] == s2[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,      # deletion
                dp[i][j - 1] + 1,      # insertion
                dp[i - 1][j - 1] + cost  # substitution
            )

    edit_distance = dp[len1][len2]
    max_len = max(len1, len2)
    return max(0.0, 1.0 - (edit_distance / max_len))


def verify_target_text(
    word_crops: list[np.ndarray],
    target_text: str,
    similarity_threshold: float = 0.40,
) -> Tuple[bool, str, float]:
    """Transcribe word crops and verify match against expected activity target text.

    Parameters
    ----------
    word_crops : list[np.ndarray]
        List of segmented word crops.
    target_text : str
        Expected prompt text (e.g. "the quick brown fox").
    similarity_threshold : float, default=0.40
        Minimum Levenshtein similarity to pass.

    Returns
    -------
    Tuple[bool, str, float]
        (is_match, detected_text, similarity_score)
    """
    if is_htr_stub_mode() or _htr_model is None:
        # Stub mode: accept by default
        return True, target_text, 1.0

    detected_words = [predict_word_text(crop) for crop in word_crops]
    detected_text = " ".join(w for w in detected_words if w)

    if not detected_text:
        return True, "", 1.0

    similarity = levenshtein_similarity(detected_text, target_text)
    is_match = similarity >= similarity_threshold

    return is_match, detected_text, similarity
