"""
Schema for the activity log. Additive and idempotent, with row-level security on so Supabase's
auto-generated REST API cannot serve it to anyone holding the project's public anon key.
"""

from sqlalchemy import text

STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS audit_events (
        id SERIAL PRIMARY KEY,
        at BIGINT NOT NULL,
        "actorKind" VARCHAR NOT NULL,
        "actorUserId" VARCHAR,
        "actorName" VARCHAR NOT NULL,
        "actorRole" VARCHAR,
        action VARCHAR NOT NULL,
        "entityType" VARCHAR NOT NULL,
        "entityId" VARCHAR,
        "entityName" VARCHAR,
        "clientId" VARCHAR,
        summary TEXT
    )
    """,
    'CREATE INDEX IF NOT EXISTS ix_audit_events_at ON audit_events (at)',
    'CREATE INDEX IF NOT EXISTS "ix_audit_events_actorUserId" ON audit_events ("actorUserId")',
    'CREATE INDEX IF NOT EXISTS "ix_audit_events_entityType" ON audit_events ("entityType")',
    'CREATE INDEX IF NOT EXISTS "ix_audit_events_entityId" ON audit_events ("entityId")',
    'CREATE INDEX IF NOT EXISTS "ix_audit_events_clientId" ON audit_events ("clientId")',
    'ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY',
]


def ensure_audit_schema(engine) -> bool:
    if engine.dialect.name != "postgresql":
        return True
    with engine.begin() as conn:
        for statement in STATEMENTS:
            conn.execute(text(statement))
    return not missing_audit_schema(engine)


def missing_audit_schema(engine) -> list[str]:
    if engine.dialect.name != "postgresql":
        return []
    with engine.connect() as conn:
        found = conn.execute(
            text("SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'audit_events'")
        ).first()
    return [] if found else ["audit_events"]
