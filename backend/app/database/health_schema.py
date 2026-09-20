"""
Schema for screen health: five nullable columns on ``devices``. Additive and idempotent.

Unlike the other additive schemas this one touches a table every screen depends on, and the Device
model selects these columns on every query. If they were missing, every playlist poll would fail and
every screen would go dark. They are therefore applied by ``migrate_health.py`` in the pre-deploy
step, where a failure aborts the deploy and leaves the running version alone, as well as at startup.
"""

from sqlalchemy import text

_COLUMNS = [
    ("lastError", "TEXT"),
    ("lastErrorAt", "BIGINT"),
    ("pendingPlays", "INTEGER"),
    ("screenshotRequestedAt", "BIGINT"),
    ("screenshotAt", "BIGINT"),
]

STATEMENTS = [f'ALTER TABLE devices ADD COLUMN IF NOT EXISTS "{name}" {kind}' for name, kind in _COLUMNS]


def ensure_health_schema(engine) -> bool:
    if engine.dialect.name != "postgresql":
        return True
    with engine.begin() as conn:
        for statement in STATEMENTS:
            conn.execute(text(statement))
    return not missing_health_schema(engine)


def missing_health_schema(engine) -> list[str]:
    if engine.dialect.name != "postgresql":
        return []
    missing = []
    with engine.connect() as conn:
        for name, _ in _COLUMNS:
            found = conn.execute(
                text(
                    "SELECT 1 FROM information_schema.columns "
                    "WHERE table_schema = current_schema() AND table_name = 'devices' AND column_name = :c"
                ),
                {"c": name},
            ).first()
            if not found:
                missing.append(f"devices.{name}")
    return missing
