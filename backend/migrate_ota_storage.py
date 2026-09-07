"""
Adds app_updates.storage_uri so OTA releases can live in object storage instead of the
server's local disk (which is wiped on every Railway redeploy).

Safe to run repeatedly and safe to run against a live database: it only adds a nullable
column and never touches existing rows. Rows left with storage_uri = NULL keep working via
the local-disk path until they are re-uploaded.

    python migrate_ota_storage.py
"""

import sys

from sqlalchemy import text

from app.core.config import settings
from app.database.database import engine

DDL = 'ALTER TABLE app_updates ADD COLUMN IF NOT EXISTS storage_uri TEXT'


def main() -> int:
    print(f"Target database: {settings.DATABASE_URL.split('@')[-1]}")
    try:
        with engine.begin() as conn:
            conn.execute(text(DDL))
            present = conn.execute(
                text(
                    "SELECT COUNT(*) FROM information_schema.columns "
                    "WHERE table_name = 'app_updates' AND column_name = 'storage_uri'"
                )
            ).scalar()
            if not present:
                print("FAILED: storage_uri column is still missing after the migration.")
                return 1

            total = conn.execute(text("SELECT COUNT(*) FROM app_updates")).scalar()
            local_only = conn.execute(
                text("SELECT COUNT(*) FROM app_updates WHERE storage_uri IS NULL")
            ).scalar()
    except Exception as exc:  # noqa: BLE001 - surface any DB error to the operator
        print(f"FAILED: {exc}")
        return 1

    print("OK: app_updates.storage_uri is present.")
    print(f"     {total} release(s) recorded, {local_only} still local-disk only.")
    if local_only:
        print("     Re-upload those releases so they survive the next redeploy.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
