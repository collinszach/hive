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
    # Note: webhook authentication now uses Plaid's JWKS JWT verification
    # (Plaid-Verification header) rather than a shared secret.

    # Anthropic
    anthropic_api_key: str = ""

    # Ollama
    ollama_url: str = "http://host.docker.internal:11434"
    ollama_model: str = "llama3.2"
    ollama_chat_model: str = "qwen2.5:7b"

    # SnapTrade
    snaptrade_client_id: str = ""
    snaptrade_consumer_key: str = ""
    app_base_url: str = "https://hive.zacharyjcollins.com"

    # Market data (paper-trading signal engine). Tiingo free tier serves
    # multi-year daily OHLCV history; the connector is provider-agnostic
    # (app/marketdata/connector.py) so the source stays swappable. Empty key =
    # paper-trading data layer skips gracefully, like SnapTrade/Plaid.
    tiingo_api_key: str = ""

    # Encryption (Fernet key for access tokens at rest) — REQUIRED (no default)
    # Generate: python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    fernet_key: str

    # Redis auth
    redis_password: str = ""

    # Celery
    celery_timezone: str = "America/Chicago"

    # App
    secret_key: str
    # Seed admin account — created automatically on first startup if no users exist.
    # Change the password after first login; the env var is only used for seeding.
    admin_username: str = "admin"
    admin_password: str = ""
    allowed_origins: list[str] = ["http://localhost:3000"]
    cookie_secure: bool = True  # Set to false only for local HTTP dev (e.g. COOKIE_SECURE=false in .env)
    log_level: str = "INFO"

    # Frontend
    next_public_api_url: str = "http://backend:8000"
    next_public_external_api_url: str = ""

    # Notifications (optional)
    slack_webhook_url: str = ""
    ntfy_url: str = ""
    ntfy_topic: str = "finance-alerts"

    # Apple Push Notification service (APNs) — token-based auth (.p8 key).
    # The .p8 file is a secret: mount it on the host and point apns_key_path at it.
    # NEVER commit the key. apns_use_sandbox=True for dev builds, False for TestFlight/App Store.
    apns_key_id: str = ""
    apns_team_id: str = ""
    apns_key_path: str = ""  # filesystem path to AuthKey_XXXXXXXX.p8
    apns_bundle_id: str = "com.zacharyjcollins.hive"
    apns_use_sandbox: bool = True

    # Stripe (get from dashboard.stripe.com)
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_starter_price_id: str = ""
    stripe_pro_price_id: str = ""

    # Apple StoreKit 2 in-app purchase (iOS).
    # Product IDs are created in App Store Connect and must match the iOS app's
    # IAPManager.productIDs. apple_iap_environment is "Sandbox" (dev/TestFlight) or
    # "Production". app_apple_id is the numeric App Store app id (needed only to verify
    # production App Store Server Notifications). apple_root_ca_dir holds Apple's public
    # root CA .cer/.der files used to verify the signed JWS chain (download from
    # apple.com/certificateauthority — not secret, but kept out of git for cleanliness).
    apple_iap_bundle_id: str = "com.zacharyjcollins.hive"
    apple_iap_environment: str = "Sandbox"
    apple_iap_app_apple_id: int = 0
    apple_root_ca_dir: str = ""
    apple_iap_enable_online_checks: bool = True

    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = ""
    # iOS OAuth client id (reversed-client-id URL scheme lives in the app).
    # The native sign-in endpoint accepts ID tokens whose `aud` matches this
    # OR the web `google_client_id` above.
    google_ios_client_id: str = ""

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
