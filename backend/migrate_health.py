"""
Adds the screen-health columns to ``devices``. Additive and idempotent.

Run in the pre-deploy step: the backend selects these columns on every device query, so they must
exist before the new code serves a single request.

    python migrate_health.py            # apply
    python migrate_health.py --check    # report only, change nothing
"""

import sys

from app.core.config import settings
from app.database.database import engine
from app.database.health_schema import ensure_health_schema, missing_health_schema


def main() -> int:
    check_only = "--check" in sys.argv[1:]
    print(f"Target database: {settings.DATABASE_URL.split('@')[-1]}")
    try:
        if not check_only:
            ensure_health_schema(engine)
        missing = missing_health_schema(engine)
    except Exception as exc:  # noqa: BLE001 - surface any DB error to the operator
        print(f"FAILED: {exc}")
        return 1

    if missing:
        print("MISSING: " + ", ".join(missing))
        return 1
    print("OK: screen-health columns are present on devices.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
