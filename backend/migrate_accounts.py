"""
Adds user accounts and per-client ownership to an existing database.

Creates the clients, users and user_sessions tables and adds a nullable "clientId" column to
devices, media, playlists and schedules. Additive and idempotent: safe to run repeatedly, safe
against a live database, and safe to run *before* deploying the backend that uses it, because code
that predates accounts ignores the new columns.

    python migrate_accounts.py            # apply
    python migrate_accounts.py --check    # report only, change nothing

The backend also applies the same statements at startup, so this script is for running the change
ahead of a deploy or for confirming a database is ready.
"""

import sys

from app.core.config import settings
from app.database.account_schema import ensure_account_schema, missing_account_schema
from app.database.database import engine


def main() -> int:
    check_only = "--check" in sys.argv[1:]
    print(f"Target database: {settings.DATABASE_URL.split('@')[-1]}")
    try:
        if check_only:
            missing = missing_account_schema(engine)
        else:
            ensure_account_schema(engine)
            missing = missing_account_schema(engine)
    except Exception as exc:  # noqa: BLE001 - surface any DB error to the operator
        print(f"FAILED: {exc}")
        return 1

    if missing:
        print("MISSING: " + ", ".join(missing))
        return 1
    print("OK: accounts schema is present (clients, users, user_sessions, and clientId on the four content tables).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
