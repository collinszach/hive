from functools import lru_cache
from urllib.parse import quote_plus

from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # PostgreSQL
    postgres_host: str = "postgres"
    postgres_port: int = 5432
    postgres_db: str = "finance"
    postgres_user: str = "admin"
    postgres_password: str

    # Redis
    redis_url: str = "redis://redis:6379/0"
    celery_broker_url: str = "redis://redis:6379/0"
    celery_result_backend: str = "redis://redis:6379/1"

    # Plaid
    plaid_client_id: str = ""
    plaid_secret: str = ""
    plaid_env: str = "development"
    plaid_webhook_url: str = ""
    # Required for OAuth banks (Capital One, Chase, Wells Fargo, etc.)
    # Must match a URI registered in Plaid dashboard → Team Settings → API
    plaid_redirect_uri: str = ""

    # Anthropic
    anthropic_api_key: str = ""

    # Ollama
    ollama_url: str = "http://host.docker.internal:11434"
    ollama_model: str = "llama3.2"

    # SnapTrade
    snaptrade_client_id: str = ""
    snaptrade_consumer_key: str = ""

    # App
    secret_key: str = ""
    log_level: str = "INFO"
    # Shared secret between Next.js proxy and FastAPI — never sent to the browser
    # Generate with: openssl rand -hex 32
    internal_api_token: str = ""

    # Frontend
    next_public_api_url: str = "http://backend:8000"
    next_public_external_api_url: str = ""
    frontend_url: str = "http://127.0.0.1:3000"

    # Notifications (optional)
    slack_webhook_url: str = ""
    ntfy_url: str = ""
    ntfy_topic: str = "finance-alerts"

    @computed_field
    @property
    def database_url(self) -> str:
        pw = quote_plus(self.postgres_password)
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{pw}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @computed_field
    @property
    def database_sync_url(self) -> str:
        pw = quote_plus(self.postgres_password)
        return (
            f"postgresql+psycopg2://{self.postgres_user}:{pw}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
