"""CNN model loader (ML_PIPELINE §8, AGENTS.md §6 rule 13).

Loads the .keras artifact from Supabase Storage at startup in production.
In dev/test mode (or when no MODEL_ARTIFACT_PATH is configured), uses a stub
that returns plausible fake scores — matching TESTING.md §3.2's convention.

The loaded model is held as a module-level singleton. Single Uvicorn worker
(AGENTS.md §6 rule 15) means no duplication concern.
"""

import logging
import tempfile
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

# Module-level singleton — set by load_model(), read by get_model()
_model: Any = None
_stub_mode: bool = False


def _should_use_stub() -> bool:
    """Determine whether to use stub inference instead of a real model."""
    if settings.ENVIRONMENT == "test":
        return True
    if settings.ENVIRONMENT == "dev" and not settings.MODEL_ARTIFACT_PATH:
        return True
    return False


def load_model() -> None:
    """Load the CNN model artifact or activate stub mode.

    Called once at application startup via the FastAPI lifespan event.

    In production: downloads the .keras artifact from Supabase Storage
    and loads it into memory. Failure crashes startup (AGENTS.md §6 rule 13).

    In dev/test: activates stub mode — no real model needed.
    """
    global _model, _stub_mode

    if _should_use_stub():
        _stub_mode = True
        logger.info(
            "ML model loader: stub mode active (ENVIRONMENT=%s, MODEL_ARTIFACT_PATH=%s)",
            settings.ENVIRONMENT,
            settings.MODEL_ARTIFACT_PATH or "<empty>",
        )
        return

    # Production: download and load the real model
    logger.info(
        "ML model loader: downloading artifact from bucket=%s path=%s",
        settings.MODEL_STORAGE_BUCKET,
        settings.MODEL_ARTIFACT_PATH,
    )
    try:
        import tensorflow as tf

        from app.core.supabase import supabase_client

        response = supabase_client.storage.from_(settings.MODEL_STORAGE_BUCKET).download(
            settings.MODEL_ARTIFACT_PATH
        )

        with tempfile.NamedTemporaryFile(suffix=".keras", delete=False) as tmp:
            tmp.write(response)
            tmp_path = tmp.name

        _model = tf.keras.models.load_model(tmp_path)
        _stub_mode = False
        logger.info("ML model loader: model loaded successfully")

    except Exception as exc:
        # AGENTS.md §6 rule 13: failed load crashes startup loudly
        raise RuntimeError(
            f"CNN model failed to load from Storage "
            f"(bucket={settings.MODEL_STORAGE_BUCKET}, "
            f"path={settings.MODEL_ARTIFACT_PATH}). "
            f"This is a fatal startup error — the CNN is core functionality, "
            f"not optional. Original error: {exc}"
        ) from exc


def get_model() -> Any:
    """Return the loaded model, or None if in stub mode."""
    return _model


def is_stub_mode() -> bool:
    """Return whether the inference module is running in stub mode."""
    return _stub_mode or _should_use_stub()
