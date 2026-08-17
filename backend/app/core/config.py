from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    SUPABASE_JWT_SECRET: str
    SUPABASE_DB_URL: str
    MODEL_STORAGE_BUCKET: str = "model-artifacts"
    MODEL_ARTIFACT_PATH: str
    SCORING_ENGINE: str = "manual"
    CORS_ALLOWED_ORIGINS: str
    ENVIRONMENT: str = "dev"

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
