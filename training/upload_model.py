"""Upload a trained model artifact to Supabase Storage (ML_PIPELINE §8, AGENTS.md Rule 13).

Uploads a .keras model artifact to the private 'model-artifacts' bucket using
the backend service-role credentials, and optionally refreshes the local
backend/.cache/models/ directory so running servers immediately pick it up.

Usage:
    # Run from repository root or backend directory:
    uv run --directory backend python ../training/upload_model.py <path> [--dest-name <name>]
    
    # Or directly if inside backend:
    uv run python ../training/upload_model.py path/model.keras --dest-name writewise-model.keras
"""

import argparse
import logging
import shutil
import sys
from pathlib import Path

# Add backend directory to sys.path so we can import app.core.config and app.core.supabase
REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Upload a trained .keras model artifact to Supabase Storage."
    )
    parser.add_argument(
        "file_path",
        type=str,
        help="Local path to the .keras model artifact to upload.",
    )
    parser.add_argument(
        "--dest-name",
        type=str,
        default=None,
        help=(
            "Destination filename in the bucket (e.g., 'writewise-model.keras' "
            "or 'simplehtr_iam.keras'). Defaults to the local file's name."
        ),
    )
    parser.add_argument(
        "--bucket",
        type=str,
        default=None,
        help=(
            "Supabase Storage bucket name (defaults to MODEL_STORAGE_BUCKET "
            "from config, i.e. 'model-artifacts')."
        ),
    )
    parser.add_argument(
        "--skip-local-cache-sync",
        action="store_true",
        help="Do not copy the file into backend/.cache/models/.",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    local_file = Path(args.file_path).resolve()

    if not local_file.exists() or not local_file.is_file():
        logger.error("File not found: %s", local_file)
        sys.exit(1)

    dest_name = args.dest_name or local_file.name
    file_size_mb = local_file.stat().st_size / (1024 * 1024)

    logger.info("Preparing to upload %s (%.2f MB) as '%s'...", local_file, file_size_mb, dest_name)

    try:
        from app.core.config import settings
        from app.core.supabase import supabase_client
    except Exception as exc:
        logger.error("Failed to load backend config / supabase_client: %s", exc)
        sys.exit(1)

    bucket = args.bucket or settings.MODEL_STORAGE_BUCKET

    logger.info("Uploading to bucket '%s' on %s...", bucket, settings.SUPABASE_URL)

    with open(local_file, "rb") as f:
        file_bytes = f.read()

    try:
        # Upload with upsert=True so subsequent runs or new iterations can overwrite the artifact
        response = supabase_client.storage.from_(bucket).upload(
            path=dest_name,
            file=file_bytes,
            file_options={"upsert": "true", "content-type": "application/octet-stream"},
        )
        logger.info("Upload succeeded! Supabase Storage response: %s", response)
    except Exception as exc:
        logger.error("Upload failed: %s", exc)
        sys.exit(1)

    # Invalidate / sync local cache so the running FastAPI dev server
    # picks up the new model immediately
    if not args.skip_local_cache_sync:
        cache_dir = BACKEND_DIR / ".cache" / "models"
        cache_dir.mkdir(parents=True, exist_ok=True)
        cached_file = cache_dir / dest_name
        shutil.copy2(local_file, cached_file)
        logger.info("Synchronized local cache at %s", cached_file)

    print("\n" + "=" * 60)
    print("SUCCESS: Model uploaded successfully to Supabase Storage!")
    print(f"Bucket:    {bucket}")
    print(f"Artifact:  {dest_name}")
    print(f"Size:      {file_size_mb:.2f} MB")
    print("=" * 60)
    print("\nNext steps to activate the model:")
    print("1. Update backend/.env (for local dev):")
    if "htr" in dest_name.lower():
        print(f"   HTR_MODEL_ARTIFACT_PATH={dest_name}")
    else:
        print(f"   MODEL_ARTIFACT_PATH={dest_name}")
    print("2. Update Railway environment variables (for production):")
    if "htr" in dest_name.lower():
        print(f"   HTR_MODEL_ARTIFACT_PATH={dest_name}")
    else:
        print(f"   MODEL_ARTIFACT_PATH={dest_name}")
    print("3. Restart the FastAPI service to trigger lifespan initialization.")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
