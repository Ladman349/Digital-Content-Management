import os
from pydantic import BaseModel, Field

class Settings(BaseModel):
    APP_ENV: str = Field(default_factory=lambda: os.getenv("APP_ENV", "development"))
    DATABASE_URL: str = Field(default_factory=lambda: os.getenv("DATABASE_URL", "postgresql://postgres:121@localhost:5432/postgres"))
    
    # Supabase configurations
    SUPABASE_URL: str | None = Field(default_factory=lambda: os.getenv("SUPABASE_URL"))
    SUPABASE_SERVICE_ROLE_KEY: str | None = Field(default_factory=lambda: os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
    SUPABASE_STORAGE_BUCKET: str = Field(default_factory=lambda: os.getenv("SUPABASE_STORAGE_BUCKET", "media"))
    
    # API base and CORS configs
    API_BASE_URL: str = Field(default_factory=lambda: os.getenv("API_BASE_URL", "http://localhost:8000"))
    CORS_ALLOWED_ORIGINS: str = Field(default_factory=lambda: os.getenv("CORS_ALLOWED_ORIGINS", ""))
    SECRET_KEY: str = Field(default_factory=lambda: os.getenv("SECRET_KEY", "super-secret-key-change-in-production"))

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
