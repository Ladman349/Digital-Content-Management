"""
Adds the proof-of-play tables (play_stats, play_batches) to an existing database.

Additive and idempotent: safe to run repeatedly and against a live database. The backend applies
the same statements at startup, so this script is for running the change ahead of a deploy or for
confirming a database is ready.

    python migrate_reports.py            # apply
    python migrate_reports.py --check    # report only, change nothing
"""

import sys

from app.core.config import settings
from app.database.database import engine
from app.database.report_schema import ensure_report_schema, missing_report_schema


def main() -> int:
    check_only = "--check" in sys.argv[1:]
    print(f"Target database: {settings.DATABASE_URL.split('@')[-1]}")
    try:
        if not check_only:
            ensure_report_schema(engine)
        missing = missing_report_schema(engine)
    except Exception as exc:  # noqa: BLE001 - surface any DB error to the operator
        print(f"FAILED: {exc}")
        return 1

    if missing:
        print("MISSING: " + ", ".join(missing))
        return 1
    print("OK: reports schema is present (play_stats, play_batches).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
