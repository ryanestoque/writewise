from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.email.templates import normalize_origin, validate_sender


class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    SUPABASE_JWT_SECRET: str
    SUPABASE_DB_URL: str
    MODEL_STORAGE_BUCKET: str = "model-artifacts"
    MODEL_ARTIFACT_PATH: str = ""
    HTR_MODEL_ARTIFACT_PATH: str = ""
    SCORING_ENGINE: str = "manual"
    CORS_ALLOWED_ORIGINS: str
    ENVIRONMENT: str = "dev"
    EMAIL_DISPATCH_ENABLED: bool = False
    EMAIL_DISPATCH_SECRET: SecretStr = SecretStr("")
    RESEND_API_KEY: SecretStr = SecretStr("")
    EMAIL_FROM: str = ""
    APP_BASE_URL: str = ""

    @model_validator(mode="after")
    def validate_email_delivery(self):
        if not self.EMAIL_DISPATCH_ENABLED:
            return self
        invalid = []
        dispatch_secret = self.EMAIL_DISPATCH_SECRET.get_secret_value()
        api_key = self.RESEND_API_KEY.get_secret_value()
        if len(dispatch_secret) < 32 or any(not 33 <= ord(c) <= 126 for c in dispatch_secret):
            invalid.append("EMAIL_DISPATCH_SECRET")
        if not api_key or any(not 33 <= ord(c) <= 126 for c in api_key):
            invalid.append("RESEND_API_KEY")
        try:
            self.EMAIL_FROM = validate_sender(self.EMAIL_FROM)
        except ValueError:
            invalid.append("EMAIL_FROM")
        try:
            self.APP_BASE_URL = normalize_origin(self.APP_BASE_URL)
        except ValueError:
            invalid.append("APP_BASE_URL")
        if invalid:
            raise ValueError("Invalid email delivery configuration: " + ", ".join(invalid))
        return self

    model_config = SettingsConfigDict(env_file=".env", hide_input_in_errors=True)


settings = Settings()
