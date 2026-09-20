"""
Adversarial tests for per-client separation.

test_accounts.py proves the feature works; this file tries to break it. Every test plays a client
user ("Acme") reaching for something that is not theirs: another client's rows ("Bolt"), the
operator's rows, or links between rows that somebody else made. The rule throughout is that Acme
can neither see, change, reference nor damage anything outside Acme, and cannot learn that it
exists.
"""

import time

import pytest

from app.models.playlist_item import PlaylistItem
from app.models.user import User
from test_accounts import _device, _media, _playlist, admin, two_clients  # noqa: F401  (fixtures)


# ── helpers ─────────────────────────────────────────────────────────────────────────────
def _schedule_body(playlist_id, device_ids, name="Morning", **overrides):
    body = {
        "name": name, "playlistId": playlist_id, "startDate": "2031-03-01", "endDate": "2031-03-02",
        "startTime": "09:00:00", "endTime": "17:00:00", "repeat": "Daily", "priority": "Normal",
        "status": "Active", "deviceIds": list(device_ids),
    }
    body.update(overrides)
    return body


def _item(media_id, duration=10):
    return {"id": f"ITEM-{time.time_ns()}", "mediaId": media_id, "duration": duration}


@pytest.fixture
def world(client, admin, two_clients):
    """One screen, media file, playlist and schedule for each of Acme, Bolt and the operator."""
    out = dict(two_clients, admin=admin)
    for key, headers, tv in (("acme", two_clients["acme"], "TV-ACME"), ("bolt", two_clients["bolt"], "TV-BOLT"), ("op", admin, "TV-OP")):
        _device(client, headers, tv)
        media = _media(client, headers, f"{key}.png")
        playlist = _playlist(client, headers, media["id"], device_ids=[tv], name=f"{key} loop")
        assert playlist.status_code == 201, playlist.text
        schedule = client.post("/schedules", json=_schedule_body(playlist.json()["id"], [tv], name=f"{key} schedule"), headers=headers)
        assert schedule.status_code == 201, schedule.text
        out[f"{key}_tv"] = tv
        out[f"{key}_media"] = media["id"]
        out[f"{key}_playlist"] = playlist.json()["id"]
        out[f"{key}_schedule"] = schedule.json()["id"]
        time.sleep(0.002)  # playlist and schedule ids are millisecond timestamps
    return out


# ── Reading, changing and deleting by id ────────────────────────────────────────────────
@pytest.mark.parametrize("owner", ["bolt", "op"])
def test_foreign_rows_cannot_be_read_changed_or_deleted(client, world, owner):
    acme = world["acme"]
    targets = {
        f"/devices/{world[f'{owner}_tv']}": {"name": "hijacked"},
        f"/media/{world[f'{owner}_media']}": {"name": "hijacked"},
        f"/playlists/{world[f'{owner}_playlist']}": {"name": "hijacked"},
        f"/schedules/{world[f'{owner}_schedule']}": {"name": "hijacked"},
    }
    for path, change in targets.items():
        assert client.get(path, headers=acme).status_code == 404, path
        assert client.put(path, json=change, headers=acme).status_code == 404, path
        assert client.delete(path, headers=acme).status_code == 404, path
        # Untouched, as its owner (or the operator) sees it.
        after = client.get(path, headers=world["admin"])
        assert after.status_code == 200 and after.json()["name"] != "hijacked", path


def test_lists_hold_only_the_callers_rows(client, world):
    acme = world["acme"]
    assert [d["id"] for d in client.get("/devices", headers=acme).json()] == [world["acme_tv"]]
    assert [m["id"] for m in client.get("/media", headers=acme).json()] == [world["acme_media"]]
    assert [p["id"] for p in client.get("/playlists", headers=acme).json()] == [world["acme_playlist"]]
    assert [s["id"] for s in client.get("/schedules", headers=acme).json()] == [world["acme_schedule"]]


def test_both_api_mounts_are_guarded(client, world):
    """The routers are mounted at the root and under /api/v1; neither may be a way round."""
    assert client.get(f"/api/v1/devices/{world['bolt_tv']}", headers=world["acme"]).status_code == 404
    assert [d["id"] for d in client.get("/api/v1/devices", headers=world["acme"]).json()] == [world["acme_tv"]]
    assert client.get("/api/v1/devices").status_code == 401


# ── Referencing somebody else's rows from your own ──────────────────────────────────────
@pytest.mark.parametrize("owner", ["bolt", "op"])
def test_own_playlist_cannot_be_pointed_at_foreign_media_or_screens(client, world, owner):
    acme, path = world["acme"], f"/playlists/{world['acme_playlist']}"
    foreign_item = {"items": [_item(world["acme_media"]), _item(world[f"{owner}_media"])]}
    assert client.put(path, json=foreign_item, headers=acme).status_code == 400
    assert client.put(path, json={"assignedDeviceIds": [world[f"{owner}_tv"]]}, headers=acme).status_code == 400

    # The foreign screen keeps playing what it was playing.
    assert client.get(f"/devices/{world[f'{owner}_tv']}/current-playlist").json()["playlistId"] == world[f"{owner}_playlist"]
    assert [i["mediaId"] for i in client.get(path, headers=acme).json()["items"]] == [world["acme_media"]]


@pytest.mark.parametrize("owner", ["bolt", "op"])
def test_own_schedule_cannot_be_pointed_at_a_foreign_playlist_or_screen(client, world, owner):
    acme, path = world["acme"], f"/schedules/{world['acme_schedule']}"
    assert client.put(path, json={"playlistId": world[f"{owner}_playlist"]}, headers=acme).status_code == 400
    assert client.put(path, json={"deviceIds": [world[f"{owner}_tv"]]}, headers=acme).status_code == 400
    assert client.post("/schedules", json=_schedule_body(world["acme_playlist"], [world[f"{owner}_tv"]], name="x",
                                                          startDate="2032-01-01", endDate="2032-01-02"), headers=acme).status_code == 400
    unchanged = client.get(path, headers=acme).json()
    assert unchanged["playlistId"] == world["acme_playlist"] and unchanged["deviceIds"] == [world["acme_tv"]]


def test_a_foreign_id_and_a_missing_id_are_indistinguishable(client, world):
    acme, path = world["acme"], f"/playlists/{world['acme_playlist']}"
    foreign = client.put(path, json={"assignedDeviceIds": [world["bolt_tv"]]}, headers=acme)
    missing = client.put(path, json={"assignedDeviceIds": ["TV-NEVER-EXISTED"]}, headers=acme)
    assert foreign.status_code == missing.status_code == 400
    assert foreign.json()["detail"].replace(world["bolt_tv"], "X") == missing.json()["detail"].replace("TV-NEVER-EXISTED", "X")


# ── Ownership cannot be chosen by the caller ────────────────────────────────────────────
def test_payload_cannot_choose_the_owner_of_a_new_row(client, world):
    res = client.post(
        "/devices",
        json={"id": "TV-SNEAK", "name": "x", "location": "x", "resolution": "1x1", "status": "Offline", "lastSeen": "never",
              "lastSeenMs": 0, "clientId": world["bolt_id"]},
        headers=world["acme"],
    )
    assert res.status_code == 201 and res.json()["clientId"] == world["acme_id"]
    assert "TV-SNEAK" not in [d["id"] for d in client.get("/devices", headers=world["bolt"]).json()]


@pytest.mark.parametrize("kind", ["devices", "media", "playlists", "schedules"])
def test_client_can_neither_give_away_nor_release_a_row(client, world, kind):
    key = {"devices": "acme_tv", "media": "acme_media", "playlists": "acme_playlist", "schedules": "acme_schedule"}[kind]
    path = f"/{kind}/{world[key]}"
    for owner in (world["bolt_id"], None):
        res = client.put(path, json={"clientId": owner}, headers=world["acme"])
        assert res.status_code == 200 and res.json()["clientId"] == world["acme_id"], (kind, owner)


def test_client_user_with_no_client_sees_nothing_and_creates_nothing(client, world, db_session):
    """Cannot be produced through the API; guards against a hand-edited database row."""
    db_session.query(User).filter(User.email == "ann@acme.test").update({"clientId": None})
    db_session.commit()
    acme = world["acme"]
    for path in ("/devices", "/media", "/playlists", "/schedules"):
        assert client.get(path, headers=acme).json() == [], path
    assert client.get(f"/devices/{world['op_tv']}", headers=acme).status_code == 404
    res = client.post("/devices", json={"id": "TV-ORPHAN", "name": "x", "location": "x", "resolution": "1x1", "status": "Offline",
                                        "lastSeen": "never", "lastSeenMs": 0}, headers=acme)
    assert res.status_code == 403


def test_moving_a_user_to_another_client_takes_effect_on_their_open_session(client, world):
    ann = next(u for u in client.get("/users", headers=world["admin"]).json() if u["email"] == "ann@acme.test")
    assert client.put(f"/users/{ann['id']}", json={"clientId": world["bolt_id"]}, headers=world["admin"]).status_code == 200
    assert [d["id"] for d in client.get("/devices", headers=world["acme"]).json()] == [world["bolt_tv"]]


# ── Links made by somebody else ─────────────────────────────────────────────────────────
def test_assignments_to_screens_the_client_cannot_see_are_hidden_and_survive_an_edit(client, world):
    """
    The operator puts Acme's playlist on the operator's own screen and on Bolt's. Acme must not
    learn those screens exist, and must not knock them off by saving the playlist.
    """
    admin, acme, path = world["admin"], world["acme"], f"/playlists/{world['acme_playlist']}"
    everyone = [world["acme_tv"], world["op_tv"], world["bolt_tv"]]
    assert client.put(path, json={"assignedDeviceIds": everyone}, headers=admin).status_code == 200

    assert client.get(path, headers=acme).json()["assignedDeviceIds"] == [world["acme_tv"]]
    assert client.get("/playlists", headers=acme).json()[0]["assignedDeviceIds"] == [world["acme_tv"]]

    saved = client.put(path, json={"name": "Renamed", "assignedDeviceIds": [world["acme_tv"]]}, headers=acme)
    assert saved.status_code == 200 and saved.json()["assignedDeviceIds"] == [world["acme_tv"]]
    assert sorted(client.get(path, headers=admin).json()["assignedDeviceIds"]) == sorted(everyone)

    # Taking their own screen off leaves the other two alone.
    assert client.put(path, json={"assignedDeviceIds": []}, headers=acme).json()["assignedDeviceIds"] == []
    assert sorted(client.get(path, headers=admin).json()["assignedDeviceIds"]) == sorted([world["op_tv"], world["bolt_tv"]])


def test_schedule_screens_the_client_cannot_see_are_hidden_and_survive_an_edit(client, world):
    admin, acme, path = world["admin"], world["acme"], f"/schedules/{world['acme_schedule']}"
    # A window nothing else uses, so the operator's and Bolt's own schedules do not conflict.
    everyone = [world["acme_tv"], world["op_tv"], world["bolt_tv"]]
    moved = client.put(path, json={"startTime": "18:00:00", "endTime": "19:00:00", "deviceIds": everyone}, headers=admin)
    assert moved.status_code == 200, moved.text

    assert client.get(path, headers=acme).json()["deviceIds"] == [world["acme_tv"]]
    assert client.get("/schedules", headers=acme).json()[0]["deviceIds"] == [world["acme_tv"]]

    saved = client.put(path, json={"name": "Evening", "deviceIds": [world["acme_tv"]]}, headers=acme)
    assert saved.status_code == 200 and saved.json()["deviceIds"] == [world["acme_tv"]]
    assert sorted(client.get(path, headers=admin).json()["deviceIds"]) == sorted(everyone)


def test_client_can_still_edit_a_playlist_the_operator_added_media_to(client, world):
    """The operator's file stays where it was put; Acme can reorder around it but not add more."""
    admin, acme, path = world["admin"], world["acme"], f"/playlists/{world['acme_playlist']}"
    mixed = {"items": [_item(world["acme_media"]), _item(world["op_media"])]}
    assert client.put(path, json=mixed, headers=admin).status_code == 200

    reordered = {"items": [_item(world["op_media"], 25), _item(world["acme_media"], 5)]}
    res = client.put(path, json=reordered, headers=acme)
    assert res.status_code == 200, res.text
    assert [(i["mediaId"], i["duration"]) for i in res.json()["items"]] == [(world["op_media"], 25), (world["acme_media"], 5)]

    # Already-present operator media is tolerated; anything new that is not Acme's is not.
    sneaky = {"items": [_item(world["op_media"]), _item(world["bolt_media"])]}
    assert client.put(path, json=sneaky, headers=acme).status_code == 400
    # Once removed, it cannot be put back.
    assert client.put(path, json={"items": [_item(world["acme_media"])]}, headers=acme).status_code == 200
    assert client.put(path, json=mixed, headers=acme).status_code == 400


def test_client_can_still_edit_a_schedule_the_operator_pointed_at_an_operator_playlist(client, world):
    admin, acme, path = world["admin"], world["acme"], f"/schedules/{world['acme_schedule']}"
    assert client.put(path, json={"playlistId": world["op_playlist"]}, headers=admin).status_code == 200

    # The CMS sends the whole form back, unchanged playlist included.
    res = client.put(path, json={"name": "Renamed", "playlistId": world["op_playlist"]}, headers=acme)
    assert res.status_code == 200 and res.json()["name"] == "Renamed"
    assert client.put(path, json={"playlistId": world["bolt_playlist"]}, headers=acme).status_code == 400


def test_assigning_own_screen_does_not_disturb_foreign_screens_on_other_playlists(client, world):
    acme = world["acme"]
    second = _playlist(client, acme, world["acme_media"], device_ids=[world["acme_tv"]], name="Second")
    assert second.status_code == 201
    assert client.get(f"/devices/{world['bolt_tv']}/current-playlist").json()["playlistId"] == world["bolt_playlist"]
    assert client.get(f"/devices/{world['op_tv']}/current-playlist").json()["playlistId"] == world["op_playlist"]


# ── Identifiers the caller supplies ─────────────────────────────────────────────────────
def test_reusing_another_playlists_item_id_neither_fails_nor_touches_it(client, world, db_session):
    bolt_item = db_session.query(PlaylistItem).filter(PlaylistItem.playlistId == world["bolt_playlist"]).one()
    bolt_item_id = bolt_item.id

    stolen = {"items": [{"id": bolt_item_id, "mediaId": world["acme_media"], "duration": 99}]}
    res = client.put(f"/playlists/{world['acme_playlist']}", json=stolen, headers=world["acme"])
    assert res.status_code == 200, res.text
    assert res.json()["items"][0]["id"] != bolt_item_id

    created = client.post("/playlists", json={"name": "Copy", "description": "", "status": "Draft", "totalDuration": 10, "updatedAt": 0,
                                              "items": stolen["items"], "assignedDeviceIds": []}, headers=world["acme"])
    assert created.status_code == 201, created.text

    theirs = client.get(f"/playlists/{world['bolt_playlist']}", headers=world["bolt"]).json()["items"]
    assert [(i["id"], i["mediaId"], i["duration"]) for i in theirs] == [(bolt_item_id, world["bolt_media"], 10)]


def test_creating_a_screen_with_a_taken_id_does_not_reveal_whose_it_is(client, world):
    body = {"name": "x", "location": "x", "resolution": "1x1", "status": "Offline", "lastSeen": "never", "lastSeenMs": 0}
    res = client.post("/devices", json={**body, "id": world["bolt_tv"]}, headers=world["acme"])
    assert res.status_code == 409
    assert "bolt" not in res.text.lower() and world["bolt_id"] not in res.text
    assert client.get(f"/devices/{world['bolt_tv']}", headers=world["bolt"]).json()["name"] == world["bolt_tv"]


# ── Administrator behaviour that must not regress ───────────────────────────────────────
def test_administrator_still_sees_and_edits_every_assignment(client, world):
    admin, path = world["admin"], f"/playlists/{world['acme_playlist']}"
    res = client.put(path, json={"assignedDeviceIds": [world["bolt_tv"]]}, headers=admin)
    assert res.status_code == 200 and res.json()["assignedDeviceIds"] == [world["bolt_tv"]]
    scoped = {**admin, "X-Client-Scope": world["acme_id"]}
    assert client.get(path, headers=scoped).json()["assignedDeviceIds"] == [world["bolt_tv"]]
