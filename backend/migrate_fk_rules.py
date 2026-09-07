"""
Aligns foreign-key delete rules with the behaviour the API promises.

Two references must be RESTRICT rather than CASCADE:

* ``playlist_items.mediaId`` — deleting media that a playlist still uses has to be refused (the API
  answers 409). With CASCADE the database silently strips the items out of every playlist and leaves
  ``totalDuration`` stale, and the 409 guard becomes unreachable.
* ``schedules.playlistId`` — deleting a playlist a schedule still points at has to be refused, not
  silently delete the schedule.

Earlier revisions of ``migration_to_new_supabase.sql`` created both as CASCADE, so any project
provisioned from it needs this repair. Junction tables (``device_playlists``, ``schedule_devices``)
and ``playlist_items.playlistId`` stay CASCADE, which is correct: those rows exist only to describe
their parent.

Reports the current state and changes only what is wrong. Safe to re-run.

    python migrate_fk_rules.py            # report and repair
    python migrate_fk_rules.py --check    # report only, exit 1 if repair is needed
"""

import sys

from sqlalchemy import text

from app.core.config import settings
from app.database.database import engine

# table, column, referenced table, desired delete rule
DESIRED = [
    ("playlist_items", "mediaId", "media", "RESTRICT"),
    ("schedules", "playlistId", "playlists", "RESTRICT"),
    ("playlist_items", "playlistId", "playlists", "CASCADE"),
    ("device_playlists", "playlistId", "playlists", "CASCADE"),
    ("device_playlists", "deviceId", "devices", "CASCADE"),
    ("schedule_devices", "scheduleId", "schedules", "CASCADE"),
    ("schedule_devices", "deviceId", "devices", "CASCADE"),
]

CURRENT_RULES_SQL = text(
    """
    SELECT tc.table_name, kcu.column_name, tc.constraint_name, rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    """
)


def main() -> int:
    check_only = "--check" in sys.argv
    print(f"Target database: {settings.DATABASE_URL.split('@')[-1]}\n")

    with engine.connect() as conn:
        rows = list(conn.execute(CURRENT_RULES_SQL))

    # (table, column) -> (constraint_name, delete_rule)
    current = {(r[0], r[1]): (r[2], r[3]) for r in rows}

    repairs = []
    print(f"{'TABLE':<20}{'COLUMN':<14}{'RULE':<12}{'WANTED':<12}STATUS")
    for table, column, ref_table, wanted in DESIRED:
        found = current.get((table, column))
        if not found:
            print(f"{table:<20}{column:<14}{'-':<12}{wanted:<12}missing (skipped)")
            continue
        name, rule = found
        # NO ACTION and RESTRICT both refuse the delete; only the deferral timing differs.
        equivalent = {rule, wanted} <= {"RESTRICT", "NO ACTION"}
        ok = rule == wanted or equivalent
        print(f"{table:<20}{column:<14}{rule:<12}{wanted:<12}{'ok' if ok else 'NEEDS REPAIR'}")
        if not ok:
            repairs.append((table, column, ref_table, wanted, name))

    if not repairs:
        print("\nAll foreign-key delete rules are correct. Nothing to do.")
        return 0

    if check_only:
        print(f"\n{len(repairs)} constraint(s) need repair. Re-run without --check to fix.")
        return 1

    print(f"\nRepairing {len(repairs)} constraint(s)...")
    try:
        with engine.begin() as conn:
            for table, column, ref_table, wanted, name in repairs:
                conn.execute(text(f'ALTER TABLE {table} DROP CONSTRAINT "{name}"'))
                conn.execute(
                    text(
                        f'ALTER TABLE {table} ADD CONSTRAINT "{name}" '
                        f'FOREIGN KEY ("{column}") REFERENCES {ref_table}(id) ON DELETE {wanted}'
                    )
                )
                print(f"  {table}.{column} -> ON DELETE {wanted}")
    except Exception as exc:  # noqa: BLE001 - surface the DB error to the operator
        print(f"\nFAILED: {exc}")
        print("No changes were committed.")
        return 1

    print("\nDone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
