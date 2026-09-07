"""
Authentication is opt-in. These tests cover both halves of that contract: nothing is enforced
until it is configured, and once configured it is actually enforced.
"""

import pytest

from app.core.config import settings

ADMIN_KEY = "test-admin-key-12345"


@pytest.fixture
def admin_auth(monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_API_KEY", ADMIN_KEY)
    return {"X-Admin-Key": ADMIN_KEY}


@pytest.fixture
def device_auth(monkeypatch):
    monkeypatch.setattr(settings, "REQUIRE_DEVICE_AUTH", True)


def _register(client):
    res = client.post("/devices/register", json={"name": "Lobby TV", "resolution": "1920x1080", "androidId": "abc123"})
    assert res.status_code == 201
    return res.json()


# ── Disabled by default ─────────────────────────────────────────────────────────────────
def test_admin_routes_open_when_key_unset(client):
    """An existing deployment must keep working after upgrading, before any key is configured."""
    assert settings.ADMIN_API_KEY == ""
    assert client.get("/devices").status_code == 200
    assert client.get("/playlists").status_code == 200
    assert client.get("/schedules").status_code == 200


def test_device_routes_open_when_flag_off(client):
    body = _register(client)
    # No Authorization header at all.
    assert client.get(f"/devices/{body['deviceId']}/status").status_code == 200


# ── Admin enforcement ───────────────────────────────────────────────────────────────────
def test_admin_routes_reject_missing_key(client, admin_auth):
    for path in ("/devices", "/playlists", "/schedules", "/media", "/app-updates/"):
        res = client.get(path)
        assert res.status_code == 401, f"{path} should require the admin key"


def test_admin_routes_reject_wrong_key(client, admin_auth):
    assert client.get("/devices", headers={"X-Admin-Key": "not-the-key"}).status_code == 401


def test_admin_routes_accept_valid_key(client, admin_auth):
    assert client.get("/devices", headers=admin_auth).status_code == 200
    assert client.get("/playlists", headers=admin_auth).status_code == 200


def test_admin_key_also_accepted_as_bearer(client, admin_auth):
    assert client.get("/devices", headers={"Authorization": f"Bearer {ADMIN_KEY}"}).status_code == 200


def test_apk_upload_requires_admin_key(client, admin_auth):
    """The route that pushes software to every screen must never be anonymous."""
    files = {"file": ("evil.apk", b"payload", "application/vnd.android.package-archive")}
    data = {"version_name": "9.9.9", "version_code": "999", "is_active": "true"}
    assert client.post("/app-updates/", files=files, data=data).status_code == 401
    assert client.post("/app-updates/", files=files, data=data, headers=admin_auth).status_code == 201


# ── Device enforcement ──────────────────────────────────────────────────────────────────
def test_device_route_rejects_missing_token(client, device_auth):
    body = _register(client)
    assert client.get(f"/devices/{body['deviceId']}/status").status_code == 401


def test_device_route_rejects_another_devices_token(client, device_auth):
    first = _register(client)
    second = client.post(
        "/devices/register", json={"name": "Second TV", "resolution": "1920x1080", "androidId": "def456"}
    ).json()

    res = client.get(
        f"/devices/{first['deviceId']}/status",
        headers={"Authorization": f"Bearer {second['deviceToken']}"},
    )
    assert res.status_code == 401


def test_device_route_accepts_own_token(client, device_auth):
    body = _register(client)
    res = client.get(
        f"/devices/{body['deviceId']}/status",
        headers={"Authorization": f"Bearer {body['deviceToken']}"},
    )
    assert res.status_code == 200


def test_heartbeat_requires_matching_token(client, device_auth):
    body = _register(client)
    payload = {"deviceId": body["deviceId"]}

    assert client.post("/devices/heartbeat", json=payload).status_code == 401
    ok = client.post(
        "/devices/heartbeat", json=payload, headers={"Authorization": f"Bearer {body['deviceToken']}"}
    )
    assert ok.status_code == 200


def test_registration_stays_open(client, device_auth):
    """A new screen has no token yet, so enrollment cannot require one."""
    assert _register(client)["deviceToken"]


def test_ota_check_requires_a_device_token(client, device_auth):
    assert client.get("/app-updates/check?version_code=1").status_code == 401
    body = _register(client)
    res = client.get(
        "/app-updates/check?version_code=1", headers={"Authorization": f"Bearer {body['deviceToken']}"}
    )
    assert res.status_code == 200
