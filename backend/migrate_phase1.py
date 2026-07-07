"""
Phase 1 Migration: Add columns for Android TV player support.

Adds:
- devices.deviceToken (VARCHAR, nullable) — Authentication token for registered devices
- devices.androidId (VARCHAR, nullable) — Stable Android device identifier for re-registration
- media.checksum (VARCHAR, nullable) — SHA-256 hash for cache validation

This migration preserves all existing data. Safe to run multiple times.
"""

from app.database.database import engine
from sqlalchemy import text


def run_migration():
    with engine.connect() as conn:
        conn.execute(text(
            'ALTER TABLE devices ADD COLUMN IF NOT EXISTS "deviceToken" VARCHAR'
        ))

        conn.execute(text(
            'ALTER TABLE devices ADD COLUMN IF NOT EXISTS "androidId" VARCHAR'
        ))

        # Partial unique index: allows multiple NULLs (CMS-created devices)
        # but prevents duplicate androidId values (re-registration safety)
        conn.execute(text(
            'CREATE UNIQUE INDEX IF NOT EXISTS ix_devices_android_id '
            'ON devices ("androidId") WHERE "androidId" IS NOT NULL'
        ))

        conn.execute(text(
            'ALTER TABLE media ADD COLUMN IF NOT EXISTS checksum VARCHAR'
        ))

        conn.commit()

    print("Phase 1 migration complete:")
    print("  + devices.deviceToken (VARCHAR, nullable)")
    print("  + devices.androidId (VARCHAR, nullable, unique where NOT NULL)")
    print("  + media.checksum (VARCHAR, nullable)")


if __name__ == "__main__":
    run_migration()
