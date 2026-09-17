"""
Schema for user accounts and per-client ownership.

Everything here is additive and idempotent: three new tables, and a nullable ``clientId`` on the
four content tables. Existing rows are untouched (NULL means "belongs to the operator"), and code
that predates accounts keeps working against the migrated database, so it is safe to apply before
the new backend is deployed and safe to apply again afterwards.

Row-level security is switched on for the three account tables. The backend connects as the table
owner and is unaffected; what it closes is Supabase's auto-generated REST API, which would otherwise
serve ``users.passwordHash`` to anyone holding the project's public anon key.
"""

from sqlalchemy import text

STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS clients (
        id VARCHAR PRIMARY KEY,
        name VARCHAR NOT NULL,
        "createdAt" BIGINT NOT NULL
    )
    """,
    'CREATE UNIQUE INDEX IF NOT EXISTS ix_clients_name_lower ON clients (lower(name))',
    """
    CREATE TABLE IF NOT EXISTS users (
        id VARCHAR PRIMARY KEY,
        email VARCHAR NOT NULL,
        name VARCHAR NOT NULL,
        "passwordHash" VARCHAR NOT NULL,
        role VARCHAR NOT NULL DEFAULT 'client',
        "clientId" VARCHAR REFERENCES clients(id),
        "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
        "createdAt" BIGINT NOT NULL,
        "lastLoginAt" BIGINT
    )
    """,
    'CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (email)',
    'CREATE INDEX IF NOT EXISTS "ix_users_clientId" ON users ("clientId")',
    """
    CREATE TABLE IF NOT EXISTS user_sessions (
        "tokenHash" VARCHAR PRIMARY KEY,
        "userId" VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "createdAt" BIGINT NOT NULL,
        "expiresAt" BIGINT NOT NULL,
        "lastUsedAt" BIGINT NOT NULL,
        "userAgent" VARCHAR
    )
    """,
    'CREATE INDEX IF NOT EXISTS "ix_user_sessions_userId" ON user_sessions ("userId")',
    'ALTER TABLE devices ADD COLUMN IF NOT EXISTS "clientId" VARCHAR REFERENCES clients(id)',
    'ALTER TABLE media ADD COLUMN IF NOT EXISTS "clientId" VARCHAR REFERENCES clients(id)',
    'ALTER TABLE playlists ADD COLUMN IF NOT EXISTS "clientId" VARCHAR REFERENCES clients(id)',
    'ALTER TABLE schedules ADD COLUMN IF NOT EXISTS "clientId" VARCHAR REFERENCES clients(id)',
    'CREATE INDEX IF NOT EXISTS "ix_devices_clientId" ON devices ("clientId")',
    'CREATE INDEX IF NOT EXISTS "ix_media_clientId" ON media ("clientId")',
    'CREATE INDEX IF NOT EXISTS "ix_playlists_clientId" ON playlists ("clientId")',
    'CREATE INDEX IF NOT EXISTS "ix_schedules_clientId" ON schedules ("clientId")',
    'ALTER TABLE clients ENABLE ROW LEVEL SECURITY',
    'ALTER TABLE users ENABLE ROW LEVEL SECURITY',
    'ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY',
]

_EXPECTED_COLUMNS = [("devices", "clientId"), ("media", "clientId"), ("playlists", "clientId"), ("schedules", "clientId")]
_EXPECTED_TABLES = ["clients", "users", "user_sessions"]


def ensure_account_schema(engine) -> bool:
    """
    Applies the statements above on PostgreSQL. Returns True when the schema is in place.

    Other dialects are skipped: the test suite builds its SQLite schema straight from the models.
    """
    if engine.dialect.name != "postgresql":
        return True
    with engine.begin() as conn:
        for statement in STATEMENTS:
            conn.execute(text(statement))
    return not missing_account_schema(engine)


def missing_account_schema(engine) -> list[str]:
    """Names whatever is still absent, for the startup log and the migration script."""
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
        for table, column in _EXPECTED_COLUMNS:
            found = conn.execute(
                text(
                    "SELECT 1 FROM information_schema.columns "
                    "WHERE table_schema = current_schema() AND table_name = :t AND column_name = :c"
                ),
                {"t": table, "c": column},
            ).first()
            if not found:
                missing.append(f"{table}.{column}")
    return missing
