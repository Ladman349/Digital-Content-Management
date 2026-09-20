"""
Schema for proof-of-play reports.

Additive and idempotent, like the accounts schema: two new tables and nothing else. Row-level
security is switched on so Supabase's auto-generated REST API cannot serve one client's play
history to anyone holding the project's public anon key; the backend connects as the table owner
and is unaffected.
"""

from sqlalchemy import text

STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS play_stats (
        id SERIAL PRIMARY KEY,
        "deviceId" VARCHAR NOT NULL,
        "mediaId" VARCHAR NOT NULL,
        "playlistId" VARCHAR NOT NULL DEFAULT '',
        "hourStart" BIGINT NOT NULL,
        plays INTEGER NOT NULL DEFAULT 0,
        "completedPlays" INTEGER NOT NULL DEFAULT 0,
        "durationMs" BIGINT NOT NULL DEFAULT 0,
        "lastPlayedAt" BIGINT NOT NULL DEFAULT 0,
        "deviceName" VARCHAR,
        "mediaName" VARCHAR,
        "mediaType" VARCHAR,
        "playlistName" VARCHAR,
        "deviceClientId" VARCHAR,
        "mediaClientId" VARCHAR,
        CONSTRAINT uq_play_stats_bucket UNIQUE ("deviceId", "mediaId", "playlistId", "hourStart")
    )
    """,
    'CREATE INDEX IF NOT EXISTS "ix_play_stats_hourStart" ON play_stats ("hourStart")',
    'CREATE INDEX IF NOT EXISTS "ix_play_stats_deviceId" ON play_stats ("deviceId")',
    'CREATE INDEX IF NOT EXISTS "ix_play_stats_mediaId" ON play_stats ("mediaId")',
    'CREATE INDEX IF NOT EXISTS "ix_play_stats_deviceClientId" ON play_stats ("deviceClientId")',
    'CREATE INDEX IF NOT EXISTS "ix_play_stats_mediaClientId" ON play_stats ("mediaClientId")',
    """
    CREATE TABLE IF NOT EXISTS play_batches (
        "batchId" VARCHAR PRIMARY KEY,
        "deviceId" VARCHAR NOT NULL,
        "receivedAt" BIGINT NOT NULL
    )
    """,
    'CREATE INDEX IF NOT EXISTS "ix_play_batches_receivedAt" ON play_batches ("receivedAt")',
    'ALTER TABLE play_stats ENABLE ROW LEVEL SECURITY',
    'ALTER TABLE play_batches ENABLE ROW LEVEL SECURITY',
]

_EXPECTED_TABLES = ["play_stats", "play_batches"]


def ensure_report_schema(engine) -> bool:
    """Applies the statements above on PostgreSQL. Other dialects build their schema from the models."""
    if engine.dialect.name != "postgresql":
        return True
    with engine.begin() as conn:
        for statement in STATEMENTS:
            conn.execute(text(statement))
    return not missing_report_schema(engine)


def missing_report_schema(engine) -> list[str]:
    if engine.dialect.name != "postgresql":
        return []
    missing = []
    with engine.connect() as conn:
        for table in _EXPECTED_TABLES:
            found = conn.execute(
                text("SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = :t"),
                {"t": table},
            ).first()
            if not found:
                missing.append(table)
    return missing
