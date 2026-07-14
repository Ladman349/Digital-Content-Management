from app.database.database import engine
from sqlalchemy import text

def run_migration():
    with engine.connect() as conn:
        if engine.dialect.name == "postgresql":
            conn.execute(text('CREATE EXTENSION IF NOT EXISTS "pgcrypto"'))
            
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS app_updates (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

                version_name VARCHAR(30) NOT NULL,
                version_code INTEGER NOT NULL UNIQUE,

                apk_filename TEXT NOT NULL,
                apk_url TEXT NOT NULL,

                checksum_sha256 TEXT NOT NULL,
                file_size BIGINT NOT NULL,

                release_notes TEXT,

                mandatory BOOLEAN DEFAULT FALSE,

                is_active BOOLEAN DEFAULT FALSE,

                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        """))
        conn.commit()

    print("OTA Migration complete: Created app_updates table")

if __name__ == "__main__":
    run_migration()
