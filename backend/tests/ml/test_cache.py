"""Tests for local model artifact caching (app.ml.cache)."""

from unittest.mock import MagicMock, patch

from app.ml.cache import get_cached_model_path


def test_get_cached_model_path_uses_existing(tmp_path):
    """If file exists in cache, it should not call Supabase download."""
    fake_file = tmp_path / "test_model.keras"
    fake_file.write_bytes(b"existing-weights")

    with (
        patch("app.ml.cache.CACHE_DIR", tmp_path),
        patch("app.ml.cache.supabase_client") as mock_supabase,
    ):
        result = get_cached_model_path("test-bucket", "test_model.keras")
        assert result == fake_file
        assert result.read_bytes() == b"existing-weights"
        mock_supabase.storage.from_.assert_not_called()


def test_get_cached_model_path_downloads_when_missing(tmp_path):
    """If file does not exist in cache, it should download from Supabase Storage."""
    mock_storage = MagicMock()
    mock_storage.download.return_value = b"downloaded-weights"

    with (
        patch("app.ml.cache.CACHE_DIR", tmp_path),
        patch("app.ml.cache.supabase_client") as mock_supabase,
    ):
        mock_supabase.storage.from_.return_value = mock_storage

        result = get_cached_model_path("test-bucket", "new_model.keras")
        assert result == tmp_path / "new_model.keras"
        assert result.read_bytes() == b"downloaded-weights"
        mock_supabase.storage.from_.assert_called_once_with("test-bucket")
        mock_storage.download.assert_called_once_with("new_model.keras")
