"""Delivery remains optional; enabled misconfiguration fails without exposing secrets."""

import pytest
from pydantic import ValidationError


def configured(**overrides):
    from app.core.config import Settings

    values = {
        "SUPABASE_URL": "http://127.0.0.1:54321",
        "SUPABASE_SERVICE_ROLE_KEY": "test-service-key",
        "SUPABASE_JWT_SECRET": "test-jwt-secret",
        "SUPABASE_DB_URL": "postgresql://localhost/test",
        "CORS_ALLOWED_ORIGINS": "http://localhost:3000",
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


def enabled_values():
    return {
        "EMAIL_DISPATCH_ENABLED": True,
        "EMAIL_DISPATCH_SECRET": "synthetic-dispatch-secret-0123456789",
        "RESEND_API_KEY": "synthetic-resend-key",
        "EMAIL_FROM": "WriteWise <classroom@example.com>",
        "APP_BASE_URL": "https://portal.example",
    }


def test_delivery_is_disabled_by_default_and_empty_credentials_are_allowed():
    settings = configured()
    assert settings.EMAIL_DISPATCH_ENABLED is False
    assert settings.EMAIL_DISPATCH_SECRET.get_secret_value() == ""
    assert settings.RESEND_API_KEY.get_secret_value() == ""


def test_enabled_settings_normalize_origin_and_hide_secrets():
    values = {**enabled_values(), "APP_BASE_URL": "https://portal.example/"}
    settings = configured(**values)
    assert settings.APP_BASE_URL == "https://portal.example"
    assert values["EMAIL_DISPATCH_SECRET"] not in repr(settings)
    assert values["RESEND_API_KEY"] not in repr(settings)


@pytest.mark.parametrize(
    "key,value",
    [
        ("EMAIL_DISPATCH_SECRET", "short-private-secret"),
        ("RESEND_API_KEY", ""),
        ("EMAIL_FROM", "sender@example.com\nBcc: leaked@example.com"),
        ("EMAIL_FROM", ""),
        ("APP_BASE_URL", "http://remote.example"),
        ("APP_BASE_URL", "https://portal.example/path"),
        ("APP_BASE_URL", "https://username:password@portal.example"),
        ("APP_BASE_URL", "https://portal.example?token=private"),
        ("APP_BASE_URL", "https://portal.example#private"),
    ],
)
def test_enabled_invalid_config_is_rejected_without_secret_values(key, value):
    values = {**enabled_values(), key: value}
    with pytest.raises(ValidationError) as captured:
        configured(**values)
    diagnostic = str(captured.value)
    for secret in [values["EMAIL_DISPATCH_SECRET"], values["RESEND_API_KEY"]]:
        if secret:
            assert secret not in diagnostic
    assert "leaked@example.com" not in diagnostic
    assert "username:password" not in diagnostic


@pytest.mark.parametrize(
    "origin", ["http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000"]
)
def test_explicit_localhost_origins_can_be_used_for_development(origin):
    assert configured(**{**enabled_values(), "APP_BASE_URL": origin}).APP_BASE_URL == origin
