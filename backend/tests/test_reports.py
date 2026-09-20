"""
Proof of play: what screens report, how it is counted, and who may read it.
"""

import datetime
import time
import uuid

import pytest

from app.core.config import settings
from app.services.report_service import TZ_OFFSET_MS, hour_start
from test_accounts import _device, _media, _playlist, admin, two_clients  # noqa: F401  (fixtures)

HOUR = 3_600_000


def _now():
    return int(time.time() * 1000)


def _batch(events, sent_at=None, batch_id=None):
    return {"batchId": batch_id or uuid.uuid4().hex, "sentAt": sent_at if sent_at is not None else _now(), "events": events}


def _event(media_id, started_at=None, duration=10_000, playlist_id=None, completed=True):
    return {"mediaId": media_id, "playlistId": playlist_id, "startedAt": started_at if started_at is not None else _now() - 60_000,
            "durationMs": duration, "completed": completed}


def _today():
    return (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(milliseconds=TZ_OFFSET_MS)).date().isoformat()


# ── Counting ────────────────────────────────────────────────────────────────────────────
def test_plays_are_counted_and_reported(client):
    _device(client, {}, "TV-1")
    media = _media(client, {}, "ad.png")
    playlist = _playlist(client, {}, media["id"], device_ids=["TV-1"]).json()

    events = [_event(media["id"], playlist_id=playlist["id"]) for _ in range(3)] + [_event(media["id"], playlist_id=playlist["id"], duration=4_000, completed=False)]
    res = client.post("/devices/TV-1/plays", json=_batch(events))
    assert res.status_code == 200 and res.json() == {"accepted": 4, "rejected": 0, "duplicate": False}

    report = client.get("/reports/plays").json()
    assert report["totals"]["plays"] == 4 and report["totals"]["completedPlays"] == 3 and report["totals"]["durationMs"] == 34_000
    assert report["totals"]["screens"] == 1 and report["totals"]["mediaFiles"] == 1
    assert [(r["name"], r["plays"], r["kind"]) for r in report["byMedia"]] == [("ad.png", 4, "Image")]
    assert [(r["id"], r["plays"]) for r in report["byDevice"]] == [("TV-1", 4)]
    assert [(r["name"], r["plays"]) for r in report["byPlaylist"]] == [("Loop", 4)]
    assert len(report["byDay"]) == 7 and report["byDay"][-1] == {"date": _today(), "plays": 4, "durationMs": 34_000}
    assert len(report["byHour"]) == 24 and sum(h["plays"] for h in report["byHour"]) == 4


def test_a_resent_batch_is_counted_once(client):
    _device(client, {}, "TV-1")
    media = _media(client, {})
    batch = _batch([_event(media["id"])])
    assert client.post("/devices/TV-1/plays", json=batch).json()["accepted"] == 1
    again = client.post("/devices/TV-1/plays", json=batch)
    assert again.status_code == 200 and again.json() == {"accepted": 0, "rejected": 0, "duplicate": True}
    assert client.get("/reports/plays").json()["totals"]["plays"] == 1


def test_the_same_batch_id_from_two_screens_is_two_batches(client):
    _device(client, {}, "TV-1")
    _device(client, {}, "TV-2")
    media = _media(client, {})
    batch = _batch([_event(media["id"])], batch_id="same-id-on-both")
    assert client.post("/devices/TV-1/plays", json=batch).json()["accepted"] == 1
    assert client.post("/devices/TV-2/plays", json=batch).json()["accepted"] == 1


def test_later_batches_add_to_the_same_hour(client):
    _device(client, {}, "TV-1")
    media = _media(client, {})
    start = hour_start(_now()) - HOUR + 60_000  # safely inside the previous hour
    client.post("/devices/TV-1/plays", json=_batch([_event(media["id"], start)]))
    client.post("/devices/TV-1/plays", json=_batch([_event(media["id"], start + 20_000), _event(media["id"], start + 40_000)]))
    report = client.get("/reports/plays").json()
    assert report["totals"]["plays"] == 3 and report["totals"]["lastPlayedAt"] == start + 40_000


def test_a_wrong_device_clock_is_corrected(client):
    """A TV that thinks it is 2015 still reports plays at the right time."""
    _device(client, {}, "TV-1")
    media = _media(client, {})
    device_now = 1_420_070_400_000  # 1 Jan 2015 on the device
    res = client.post("/devices/TV-1/plays", json=_batch([_event(media["id"], device_now - 30_000)], sent_at=device_now))
    assert res.json()["accepted"] == 1
    last = client.get("/reports/plays").json()["totals"]["lastPlayedAt"]
    assert abs(last - (_now() - 30_000)) < 5_000


def test_implausible_and_unknown_events_are_dropped_not_fatal(client):
    _device(client, {}, "TV-1")
    media = _media(client, {})
    events = [
        _event(media["id"]),
        _event("MEDIA-NEVER-EXISTED"),
        _event(media["id"], _now() + 3 * HOUR),          # future
        _event(media["id"], _now() - 100 * 24 * HOUR),   # far too old
    ]
    assert client.post("/devices/TV-1/plays", json=_batch(events)).json() == {"accepted": 1, "rejected": 3, "duplicate": False}


def test_malformed_batches_are_refused(client):
    _device(client, {}, "TV-1")
    media = _media(client, {})
    assert client.post("/devices/TV-NOPE/plays", json=_batch([_event(media["id"])])).status_code == 404
    assert client.post("/devices/TV-1/plays", json=_batch([_event(media["id"], duration=-5)])).status_code == 422
    assert client.post("/devices/TV-1/plays", json=_batch([_event(media["id"])] * 501)).status_code == 422
    assert client.post("/devices/TV-1/plays", json={"batchId": "x", "sentAt": _now(), "events": []}).status_code == 422


def test_history_outlives_the_file_and_the_screen(client):
    _device(client, {}, "TV-1")
    media = _media(client, {}, "gone.png")
    client.post("/devices/TV-1/plays", json=_batch([_event(media["id"])]))
    assert client.delete(f"/media/{media['id']}").status_code == 204
    # The screen can still deliver plays of the deleted file that it had queued while offline.
    assert client.post("/devices/TV-1/plays", json=_batch([_event(media["id"])])).json()["accepted"] == 1
    assert client.delete("/devices/TV-1").status_code == 204

    report = client.get("/reports/plays").json()
    assert [(r["name"], r["plays"], r["exists"]) for r in report["byMedia"]] == [("gone.png", 2, False)]
    assert [(r["name"], r["exists"]) for r in report["byDevice"]] == [("TV-1", False)]


def test_filters_and_date_range(client):
    _device(client, {}, "TV-1")
    _device(client, {}, "TV-2")
    a, b = _media(client, {}, "a.png"), _media(client, {}, "b.png")
    three_days_ago = _now() - 3 * 24 * HOUR
    client.post("/devices/TV-1/plays", json=_batch([_event(a["id"]), _event(b["id"]), _event(a["id"], three_days_ago)]))
    client.post("/devices/TV-2/plays", json=_batch([_event(a["id"])]))

    assert client.get("/reports/plays", params={"device_id": "TV-2"}).json()["totals"]["plays"] == 1
    assert client.get("/reports/plays", params={"media_id": b["id"]}).json()["totals"]["plays"] == 1
    assert client.get("/reports/plays", params={"date_from": _today(), "date_to": _today()}).json()["totals"]["plays"] == 3
    assert client.get("/reports/plays", params={"date_from": "2031-01-02", "date_to": "2031-01-01"}).status_code == 400
    assert client.get("/reports/plays", params={"date_from": "2020-01-01", "date_to": "2031-01-01"}).status_code == 400


def test_csv_export_is_safe_to_open_in_a_spreadsheet(client):
    _device(client, {}, "TV-1")
    media = _media(client, {}, "=HYPERLINK(evil).png")
    client.post("/devices/TV-1/plays", json=_batch([_event(media["id"]), _event(media["id"])]))
    res = client.get("/reports/plays.csv")
    assert res.status_code == 200 and res.headers["content-type"].startswith("text/csv")
    assert "attachment" in res.headers["content-disposition"]
    lines = res.text.lstrip("﻿").strip().split("\r\n")
    assert lines[0].startswith("Date,Screen,Screen ID,Media")
    assert lines[1].split(",")[0] == _today() and "'=HYPERLINK(evil).png" in lines[1] and lines[1].endswith(",2,2,20")


# ── Who may read what ───────────────────────────────────────────────────────────────────
@pytest.fixture
def network(client, admin, two_clients):
    """
    An advertising network: the operator's screen plays Acme's ad and Bolt's ad; Acme also has a
    screen of its own playing the operator's house promo.
    """
    acme, bolt = two_clients["acme"], two_clients["bolt"]
    _device(client, admin, "TV-MALL")
    _device(client, acme, "TV-ACME")
    ids = {"acme_ad": _media(client, acme, "acme-ad.png")["id"], "bolt_ad": _media(client, bolt, "bolt-ad.png")["id"], "promo": _media(client, admin, "promo.png")["id"]}
    client.post("/devices/TV-MALL/plays", json=_batch([_event(ids["acme_ad"])] * 2 + [_event(ids["bolt_ad"])] * 5 + [_event(ids["promo"])] * 7))
    client.post("/devices/TV-ACME/plays", json=_batch([_event(ids["promo"])] * 3))
    return dict(two_clients, admin=admin, **ids)


def test_reports_need_a_sign_in(client, network):
    assert client.get("/reports/plays").status_code == 401
    assert client.get("/reports/plays.csv").status_code == 401


def test_a_client_sees_plays_of_their_media_and_plays_on_their_screens(client, network):
    report = client.get("/reports/plays", headers=network["acme"]).json()
    # Their ad on the operator's screen (2) and the operator's promo on their own screen (3).
    assert report["totals"]["plays"] == 5
    assert {(r["name"], r["plays"]) for r in report["byMedia"]} == {("acme-ad.png", 2), ("promo.png", 3)}
    assert {(r["id"], r["plays"]) for r in report["byDevice"]} == {("TV-MALL", 2), ("TV-ACME", 3)}
    assert "bolt" not in client.get("/reports/plays.csv", headers=network["acme"]).text.lower()


def test_filters_cannot_reach_another_clients_numbers(client, network):
    assert client.get("/reports/plays", params={"media_id": network["bolt_ad"]}, headers=network["acme"]).json()["totals"]["plays"] == 0
    assert client.get("/reports/plays", params={"device_id": "TV-MALL"}, headers=network["bolt"]).json()["totals"]["plays"] == 5
    assert client.get("/reports/plays", params={"device_id": "TV-ACME"}, headers=network["bolt"]).json()["totals"]["plays"] == 0


def test_administrator_sees_everything_and_can_narrow_to_one_client(client, network):
    assert client.get("/reports/plays", headers=network["admin"]).json()["totals"]["plays"] == 17
    scoped = {**network["admin"], "X-Client-Scope": network["bolt_id"]}
    assert client.get("/reports/plays", headers=scoped).json()["totals"]["plays"] == 5


def test_history_travels_with_a_handover(client, network):
    """While the screen exists its current owner decides, so Bolt sees TV-MALL's past once it is theirs."""
    res = client.post("/handover", json={"deviceIds": ["TV-MALL"], "clientId": network["bolt_id"], "includeContent": False}, headers=network["admin"])
    assert res.status_code == 200
    assert client.get("/reports/plays", headers=network["bolt"]).json()["totals"]["plays"] == 14
    assert client.get("/reports/plays", headers=network["acme"]).json()["totals"]["plays"] == 5


def test_a_deleted_screens_history_stays_with_whoever_owned_it(client, network):
    assert client.delete("/devices/TV-ACME", headers=network["acme"]).status_code == 204
    assert client.get("/reports/plays", headers=network["acme"]).json()["totals"]["plays"] == 5
    assert client.get("/reports/plays", headers=network["bolt"]).json()["totals"]["plays"] == 5


def test_device_token_is_required_once_device_auth_is_on(client, network, monkeypatch, db_session):
    from app.models.device import Device

    registered = client.post("/devices/register", json={"name": "TV", "resolution": "1920x1080", "androidId": "tv-auth"}).json()
    monkeypatch.setattr(settings, "REQUIRE_DEVICE_AUTH", True)
    path = f"/devices/{registered['deviceId']}/plays"
    assert client.post(path, json=_batch([_event(network["promo"])])).status_code == 401
    assert client.post(path, json=_batch([_event(network["promo"])]), headers={"Authorization": "Bearer wrong"}).status_code == 401
    ok = client.post(path, json=_batch([_event(network["promo"])]), headers={"Authorization": f"Bearer {registered['deviceToken']}"})
    assert ok.status_code == 200 and ok.json()["accepted"] == 1
    assert db_session.query(Device).filter(Device.id == registered["deviceId"]).one().deviceToken == registered["deviceToken"]
