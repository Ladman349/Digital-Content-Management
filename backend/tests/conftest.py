from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.database import get_db
from main import app

# Use SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Media uploads and APK uploads are written to the working tree by the real service code. Without
# this the suite leaves hundreds of stray files behind on every run.
_ARTEFACT_DIRS = (
    Path("uploads") / "apk",
    Path("uploads") / "apk" / "archive",  # delete_update archives rather than removing
    Path("media"),
)


@pytest.fixture(scope="session", autouse=True)
def clean_upload_artefacts():
    """Removes only the files the test session itself created, leaving pre-existing ones alone."""

    def snapshot():
        return {d: {p for p in d.iterdir() if p.is_file()} if d.is_dir() else set() for d in _ARTEFACT_DIRS}

    before = snapshot()
    yield
    for directory, existing in snapshot().items():
        for path in existing - before.get(directory, set()):
            try:
                path.unlink()
            except OSError:
                pass


@pytest.fixture(autouse=True)
def reset_account_state():
    """
    "Does any user exist?" and the sign-in throttle are cached per process. Each test gets a
    rolled-back database, so both caches have to be forgotten along with it.
    """
    from app.core.auth import reset_login_state
    from app.services.account_service import LoginThrottle

    reset_login_state()
    LoginThrottle.reset()
    yield
    reset_login_state()
    LoginThrottle.reset()


@pytest.fixture(scope="session")
def db_engine():
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def db_session(db_engine):
    connection = db_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    yield session
    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
            
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
