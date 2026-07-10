"""
Phase 2 Migration: Add orientation column to devices.

Adds:
- devices.orientation (VARCHAR, default 'LANDSCAPE')

This migration preserves all existing data. Safe to run multiple times.
"""

from app.database.database import engine
from sqlalchemy import text


def run_migration():
    with engine.connect() as conn:
        try:
            conn.execute(text(
                'ALTER TABLE devices ADD COLUMN "orientation" VARCHAR DEFAULT \'LANDSCAPE\''
            ))
            conn.execute(text(
                'UPDATE devices SET "orientation" = \'LANDSCAPE\' WHERE "orientation" IS NULL'
            ))
            conn.commit()
            print("Successfully added orientation column to devices table.")
        except Exception as e:
            # Column might already exist or table doesn't exist yet
            print(f"Migration notice (e.g. column may already exist): {e}")

    print("Phase 2 migration complete.")


if __name__ == "__main__":
    run_migration()
