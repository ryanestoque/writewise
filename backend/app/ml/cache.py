"""Local disk cache for Supabase Storage model artifacts (ML_PIPELINE §8, AGENTS.md Rule 13).

Caches downloaded .keras weights in backend/.cache/models/ so that subsequent
application startups and Uvicorn live-reloads load directly from local disk,
avoiding repetitive multi-megabyte network downloads and preventing timeout-induced
silent stub fallbacks.
"""

import logging
from pathlib import Path

from app.core.supabase import supabase_client

logger = logging.getLogger(__name__)

CACHE_DIR = Path(__file__).resolve().parent.parent.parent / ".cache" / "models"


def get_cached_model_path(bucket: str, artifact_path: str) -> Path:
    """Retrieve the local cached path for a model artifact, downloading if not cached.

    Parameters
    ----------
    bucket : str
        Supabase Storage bucket name (e.g. 'model-artifacts').
    artifact_path : str
        Artifact filename in the bucket (e.g. 'simplehtr_iam.keras').

    Returns
    -------
    Path
        Absolute local Path to the verified, cached model artifact.
    """
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    local_file = CACHE_DIR / Path(artifact_path).name

    if local_file.exists() and local_file.stat().st_size > 0:
        logger.info(
            "Found cached model artifact at %s (%d bytes)",
            local_file,
            local_file.stat().st_size,
        )
        return local_file

    logger.info(
        "Downloading model artifact from bucket=%s path=%s to local cache %s",
        bucket,
        artifact_path,
        local_file,
    )
    response = supabase_client.storage.from_(bucket).download(artifact_path)

    # Atomic write via temp file in same directory to prevent partial reads
    temp_file = local_file.with_suffix(".tmp")
    temp_file.write_bytes(response)
    temp_file.replace(local_file)

    logger.info(
        "Cached model artifact saved to %s (%d bytes)",
        local_file,
        local_file.stat().st_size,
    )
    return local_file
