import os
from dotenv import load_dotenv
from pydantic import BaseModel, Field

# Load backend/.env (if present) before any os.getenv() defaults are evaluated
load_dotenv()

def resolve_api_base_url() -> str:
    railway_domain = os.getenv("RAILWAY_PUBLIC_DOMAIN")
    if railway_domain:
        domain = railway_domain.strip()
        if not domain.startswith("http://") and not domain.startswith("https://"):
            return f"https://{domain}"
        return domain
    return os.getenv("API_BASE_URL", "http://localhost:8000")

class Settings(BaseModel):
    APP_ENV: str = Field(default_factory=lambda: os.getenv("APP_ENV", "development"))
    DATABASE_URL: str = Field(default_factory=lambda: os.getenv("DATABASE_URL", "postgresql://postgres:121@localhost:5432/postgres"))
    
    # Database connection pool configurations (conservative defaults safe for Supabase direct connections and multi-worker setups)
    DB_POOL_SIZE: int = Field(default_factory=lambda: int(os.getenv("DB_POOL_SIZE", "5")))
    DB_MAX_OVERFLOW: int = Field(default_factory=lambda: int(os.getenv("DB_MAX_OVERFLOW", "5")))
    DB_POOL_RECYCLE: int = Field(default_factory=lambda: int(os.getenv("DB_POOL_RECYCLE", "300")))
    DB_POOL_TIMEOUT: int = Field(default_factory=lambda: int(os.getenv("DB_POOL_TIMEOUT", "30")))

    # Supabase configurations
    SUPABASE_URL: str | None = Field(default_factory=lambda: os.getenv("SUPABASE_URL"))
    SUPABASE_SERVICE_ROLE_KEY: str | None = Field(default_factory=lambda: os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
    SUPABASE_STORAGE_BUCKET: str = Field(default_factory=lambda: os.getenv("SUPABASE_STORAGE_BUCKET", "media"))
    # Player APKs live in their own bucket so an OTA release survives a backend redeploy.
    # The bucket and its public-read policy are created by migration_to_new_supabase.sql.
    SUPABASE_APK_BUCKET: str = Field(default_factory=lambda: os.getenv("SUPABASE_APK_BUCKET", "apks"))
    
    # API base and CORS configs
    API_BASE_URL: str = Field(default_factory=resolve_api_base_url)
    CORS_ALLOWED_ORIGINS: str = Field(default_factory=lambda: os.getenv("CORS_ALLOWED_ORIGINS", ""))
    SECRET_KEY: str = Field(default_factory=lambda: os.getenv("SECRET_KEY", "super-secret-key-change-in-production"))

    # ── Authentication (both opt-in; see app/core/auth.py) ────────────────────────────────
    # Set ADMIN_API_KEY to require a key on CMS routes. Empty means no admin auth, which keeps
    # existing deployments working unchanged after an upgrade.
    ADMIN_API_KEY: str = Field(default_factory=lambda: os.getenv("ADMIN_API_KEY", ""))
    # Only enable once every player in the field sends its real device token. A device that cannot
    # authenticate also cannot fetch the OTA update that would fix it.
    REQUIRE_DEVICE_AUTH: bool = Field(
        default_factory=lambda: os.getenv("REQUIRE_DEVICE_AUTH", "false").strip().lower() in ("1", "true", "yes", "on")
    )
    OTA_MAX_UPLOAD_MB: int = Field(default_factory=lambda: int(os.getenv("OTA_MAX_UPLOAD_MB", "150")))

    # ── User accounts (see app/core/auth.py) ─────────────────────────────────────────────
    # How long a CMS sign-in lasts without being used. Active sessions slide forward.
    SESSION_TTL_DAYS: int = Field(default_factory=lambda: int(os.getenv("SESSION_TTL_DAYS", "30")))
    # Creates the first administrator at startup, only while no user exists at all. Creating that
    # account is what makes sign-in mandatory. Remove BOOTSTRAP_ADMIN_PASSWORD once signed in.
    BOOTSTRAP_ADMIN_EMAIL: str = Field(default_factory=lambda: os.getenv("BOOTSTRAP_ADMIN_EMAIL", "").strip())
    BOOTSTRAP_ADMIN_PASSWORD: str = Field(default_factory=lambda: os.getenv("BOOTSTRAP_ADMIN_PASSWORD", ""))

    def validate_production(self):
        if self.APP_ENV == "production":
            # Check for placeholder credentials
            if not self.SUPABASE_URL or not self.SUPABASE_SERVICE_ROLE_KEY:
                raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured in production environment!")
            if self.SECRET_KEY == "super-secret-key-change-in-production":
                raise ValueError("SECRET_KEY must be changed from the default value in production!")
            
            # Ensure no localhost/loopback references in production URLs
            for name, val in [("DATABASE_URL", self.DATABASE_URL), ("SUPABASE_URL", self.SUPABASE_URL), ("API_BASE_URL", self.API_BASE_URL)]:
                if val and ("localhost" in val or "127.0.0.1" in val):
                    raise ValueError(f"{name} configuration cannot contain loopback/localhost references in production!")

settings = Settings()
