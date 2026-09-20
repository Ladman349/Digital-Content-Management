"""
Screen health: what the heartbeat reports, and the on-demand screenshot.
"""

import os

import pytest

from app.services import screenshot_service
from test_accounts import _device, admin, two_clients  # noqa: F401  (fixtures)

JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64 + b"\xff\xd9"


@pytest.fixture(autouse=True)
def screenshots_in_tmp(tmp_path, monkeypatch):
    monkeypatch.setattr(screenshot_service, "SCREENSHOT_DIR", str(tmp_path / "screenshots"))


def _register(client, android_id="tv-health"):
    return client.post("/devices/register", json={"name": "Lobby TV", "resolution": "1920x1080", "androidId": android_id}).json()["deviceId"]


def _upload(client, device_id, data=JPEG, name="shot.jpg"):
    return client.post(f"/devices/{device_id}/screenshot", files={"file": (name, data, "image/jpeg")})


# ── What the heartbeat carries ──────────────────────────────────────────────────────────
def test_heartbeat_reports_the_last_error_and_the_play_backlog(client):
    device_id = _register(client)
    res = client.post("/devices/heartbeat", json={"deviceId": device_id, "lastError": "PlaylistExecutor: Local file not found", "lastErrorAt": 5, "pendingPlays": 420})
    assert res.status_code == 200 and res.json()["screenshotRequested"] is False

    device = client.get(f"/devices/{device_id}").json()
    assert device["lastError"] == "PlaylistExecutor: Local file not found" and device["pendingPlays"] == 420
    first_seen = device["lastErrorAt"]
    # Timed by the server, not by a TV's clock, and not moved while the same error repeats.
    assert first_seen > 1_600_000_000_000
    client.post("/devices/heartbeat", json={"deviceId": device_id, "lastError": "PlaylistExecutor: Local file not found", "lastErrorAt": 9})
    assert client.get(f"/devices/{device_id}").json()["lastErrorAt"] == first_seen


def test_an_older_player_that_sends_none_of_this_still_works(client):
    device_id = _register(client)
    assert client.post("/devices/heartbeat", json={"deviceId": device_id, "appVersion": "1.2.0 (5)"}).status_code == 200
    device = client.get(f"/devices/{device_id}").json()
    assert device["lastError"] is None and device["pendingPlays"] is None and device["screenshotAt"] is None


def test_an_overlong_error_is_refused_rather_than_stored(client):
    device_id = _register(client)
    assert client.post("/devices/heartbeat", json={"deviceId": device_id, "lastError": "x" * 2001}).status_code == 422
    client.post("/devices/heartbeat", json={"deviceId": device_id, "lastError": "y" * 1500})
    assert len(client.get(f"/devices/{device_id}").json()["lastError"]) == 500


# ── Screenshots ─────────────────────────────────────────────────────────────────────────
def test_screenshot_round_trip(client):
    device_id = _register(client)
    assert client.get(f"/devices/{device_id}/screenshot").status_code == 404

    asked = client.post(f"/devices/{device_id}/screenshot/request")
    assert asked.status_code == 200 and asked.json()["screenshotRequestedAt"]
    assert client.post("/devices/heartbeat", json={"deviceId": device_id}).json()["screenshotRequested"] is True

    assert _upload(client, device_id).status_code == 204
    shot = client.get(f"/devices/{device_id}/screenshot")
    assert shot.status_code == 200 and shot.content == JPEG
    assert shot.headers["content-type"] == "image/jpeg" and shot.headers["cache-control"] == "no-store"
    # Answered: the screen is not asked again.
    assert client.post("/devices/heartbeat", json={"deviceId": device_id}).json()["screenshotRequested"] is False
    assert client.get(f"/devices/{device_id}").json()["screenshotAt"] >= asked.json()["screenshotRequestedAt"]


def test_a_screen_cannot_push_a_picture_nobody_asked_for(client):
    device_id = _register(client)
    assert _upload(client, device_id).status_code == 409
    client.post(f"/devices/{device_id}/screenshot/request")
    assert _upload(client, device_id).status_code == 204
    assert _upload(client, device_id).status_code == 409


def test_a_request_nobody_answered_expires(client, monkeypatch):
    device_id = _register(client)
    client.post(f"/devices/{device_id}/screenshot/request")
    later = screenshot_service._now_ms() + screenshot_service.REQUEST_TTL_MS + 1000
    monkeypatch.setattr(screenshot_service, "_now_ms", lambda: later)
    assert client.post("/devices/heartbeat", json={"deviceId": device_id}).json()["screenshotRequested"] is False
    assert _upload(client, device_id).status_code == 409


def test_only_a_small_jpeg_is_accepted(client):
    device_id = _register(client)
    client.post(f"/devices/{device_id}/screenshot/request")
    assert _upload(client, device_id, b"<html>not a picture</html>").status_code == 400
    assert _upload(client, device_id, JPEG + b"\x00" * (2 * 1024 * 1024)).status_code == 413
    assert client.get(f"/devices/{device_id}/screenshot").status_code == 404
    assert _upload(client, "TV-NOPE").status_code == 404


def test_deleting_the_screen_deletes_its_screenshot(client):
    device_id = _register(client)
    client.post(f"/devices/{device_id}/screenshot/request")
    _upload(client, device_id)
    folder = screenshot_service.SCREENSHOT_DIR
    assert len(os.listdir(folder)) == 1
    assert client.delete(f"/devices/{device_id}").status_code == 204
    assert os.listdir(folder) == []


def test_a_client_can_only_ask_for_and_see_their_own_screens(client, admin, two_clients):
    _device(client, two_clients["bolt"], "TV-BOLT")
    acme, bolt = two_clients["acme"], two_clients["bolt"]
    assert client.post("/devices/TV-BOLT/screenshot/request", headers=acme).status_code == 404
    assert client.post("/devices/TV-BOLT/screenshot/request", headers=bolt).status_code == 200
    assert _upload(client, "TV-BOLT").status_code == 204

    assert client.get("/devices/TV-BOLT/screenshot", headers=acme).status_code == 404
    assert client.get("/devices/TV-BOLT/screenshot").status_code == 401
    assert client.get("/devices/TV-BOLT/screenshot", headers=bolt).status_code == 200
    assert client.get("/devices/TV-BOLT/screenshot", headers=admin).status_code == 200
