"""
Handing screens to a client together with what they play.

The contract: whatever only those screens use travels with them, whatever something left behind
still depends on stays put and is reported, and no screen ever stops playing because of it.
"""

import time

import pytest

from test_accounts import _device, _media, _playlist, admin, two_clients  # noqa: F401  (fixtures)
from test_tenant_isolation import _schedule_body


def _handover(client, headers, device_ids, client_id, **extra):
    return client.post("/handover", json={"deviceIds": list(device_ids), "clientId": client_id, **extra}, headers=headers)


def _kinds(items):
    return sorted((i["kind"], i["name"]) for i in items)


@pytest.fixture
def lobby(client, admin):
    """An operator-owned screen with its own playlist, media file and schedule."""
    _device(client, admin, "TV-LOBBY")
    media = _media(client, admin, "lobby.png")
    playlist = _playlist(client, admin, media["id"], device_ids=["TV-LOBBY"], name="Lobby loop").json()
    time.sleep(0.002)
    night_media = _media(client, admin, "night.png")
    night = _playlist(client, admin, night_media["id"], name="Night loop").json()
    schedule = client.post("/schedules", json=_schedule_body(night["id"], ["TV-LOBBY"], name="Nights"), headers=admin)
    assert schedule.status_code == 201, schedule.text
    return {"media": media["id"], "playlist": playlist["id"], "night_media": night_media["id"], "night": night["id"], "schedule": schedule.json()["id"]}


def test_a_screen_takes_everything_only_it_plays(client, admin, two_clients, lobby):
    res = _handover(client, admin, ["TV-LOBBY"], two_clients["acme_id"])
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["applied"] is True and body["clientName"] == "Acme" and body["left"] == []
    assert _kinds(body["moved"]) == [
        ("media", "lobby.png"), ("media", "night.png"), ("playlist", "Lobby loop"), ("playlist", "Night loop"),
        ("schedule", "Nights"), ("screen", "TV-LOBBY"),
    ]

    acme = two_clients["acme"]
    assert [d["id"] for d in client.get("/devices", headers=acme).json()] == ["TV-LOBBY"]
    assert {p["name"] for p in client.get("/playlists", headers=acme).json()} == {"Lobby loop", "Night loop"}
    assert {m["name"] for m in client.get("/media", headers=acme).json()} == {"lobby.png", "night.png"}
    assert [s["name"] for s in client.get("/schedules", headers=acme).json()] == ["Nights"]
    # The other client gained nothing, and the screen never stopped playing.
    assert client.get("/playlists", headers=two_clients["bolt"]).json() == []
    assert client.get("/devices/TV-LOBBY/current-playlist").json()["playlistId"] == lobby["playlist"]


def test_dry_run_reports_and_changes_nothing(client, admin, two_clients, lobby):
    body = _handover(client, admin, ["TV-LOBBY"], two_clients["acme_id"], dryRun=True).json()
    assert body["applied"] is False and len(body["moved"]) == 6
    assert client.get("/devices", headers=two_clients["acme"]).json() == []
    assert client.get("/devices/TV-LOBBY", headers=admin).json()["clientId"] is None


def test_screen_only_leaves_content_alone(client, admin, two_clients, lobby):
    body = _handover(client, admin, ["TV-LOBBY"], two_clients["acme_id"], includeContent=False).json()
    assert _kinds(body["moved"]) == [("screen", "TV-LOBBY")]
    assert client.get("/playlists", headers=two_clients["acme"]).json() == []


def test_content_shared_with_a_screen_that_stays_is_left_and_explained(client, admin, two_clients, lobby):
    _device(client, admin, "TV-CAFE")
    shared = client.put(f"/playlists/{lobby['night']}", json={"assignedDeviceIds": ["TV-CAFE"]}, headers=admin)
    assert shared.status_code == 200

    body = _handover(client, admin, ["TV-LOBBY"], two_clients["acme_id"]).json()
    assert _kinds(body["moved"]) == [("media", "lobby.png"), ("playlist", "Lobby loop"), ("schedule", "Nights"), ("screen", "TV-LOBBY")]
    left = {i["name"]: i["reason"] for i in body["left"]}
    assert set(left) == {"Night loop", "night.png"}
    assert "TV-CAFE" in left["Night loop"] and "Night loop" in left["night.png"]
    # The café keeps its playlist.
    assert client.get("/devices/TV-CAFE/current-playlist").json()["playlistId"] == lobby["night"]


def test_handing_both_screens_over_together_moves_what_they_share(client, admin, two_clients, lobby):
    _device(client, admin, "TV-CAFE")
    client.put(f"/playlists/{lobby['night']}", json={"assignedDeviceIds": ["TV-CAFE"]}, headers=admin)
    body = _handover(client, admin, ["TV-LOBBY", "TV-CAFE"], two_clients["acme_id"]).json()
    assert body["left"] == [] and ("playlist", "Night loop") in _kinds(body["moved"])


def test_a_schedule_that_also_runs_elsewhere_stays_and_so_does_its_playlist(client, admin, two_clients, lobby):
    _device(client, admin, "TV-CAFE")
    res = client.put(f"/schedules/{lobby['schedule']}", json={"deviceIds": ["TV-LOBBY", "TV-CAFE"]}, headers=admin)
    assert res.status_code == 200, res.text

    body = _handover(client, admin, ["TV-LOBBY"], two_clients["acme_id"]).json()
    left = {i["name"]: i["reason"] for i in body["left"]}
    assert set(left) == {"Nights", "Night loop", "night.png"}
    assert "TV-CAFE" in left["Nights"] and "Nights" in left["Night loop"]


def test_another_clients_content_on_the_screen_is_never_taken(client, admin, two_clients, lobby):
    """The operator screen plays Bolt's playlist. Handing the screen to Acme must not hand Bolt's work to Acme."""
    bolt_media = _media(client, two_clients["bolt"], "bolt.png")
    time.sleep(0.002)
    bolt_playlist = _playlist(client, two_clients["bolt"], bolt_media["id"], name="Bolt loop").json()
    assert client.put(f"/playlists/{bolt_playlist['id']}", json={"assignedDeviceIds": ["TV-LOBBY"]}, headers=admin).status_code == 200

    body = _handover(client, admin, ["TV-LOBBY"], two_clients["acme_id"]).json()
    left = {i["name"]: i["reason"] for i in body["left"]}
    assert "Bolt loop" in left and "Bolt" in left["Bolt loop"]
    assert "bolt.png" in left
    assert [p["name"] for p in client.get("/playlists", headers=two_clients["bolt"]).json()] == ["Bolt loop"]
    assert "Bolt loop" not in {p["name"] for p in client.get("/playlists", headers=two_clients["acme"]).json()}


def test_handing_back_to_the_operator_works_the_same_way(client, admin, two_clients, lobby):
    _handover(client, admin, ["TV-LOBBY"], two_clients["acme_id"])
    body = _handover(client, admin, ["TV-LOBBY"], None).json()
    assert body["clientId"] is None and len(body["moved"]) == 6
    assert client.get("/devices", headers=two_clients["acme"]).json() == []
    assert client.get("/playlists", headers=two_clients["acme"]).json() == []


def test_handing_over_to_the_current_owner_is_a_no_op(client, admin, two_clients, lobby):
    _handover(client, admin, ["TV-LOBBY"], two_clients["acme_id"])
    body = _handover(client, admin, ["TV-LOBBY"], two_clients["acme_id"]).json()
    assert body["moved"] == [] and body["left"] == []


def test_bad_requests_are_refused(client, admin, two_clients, lobby):
    assert _handover(client, admin, [], two_clients["acme_id"]).status_code == 400
    assert _handover(client, admin, ["TV-NOPE"], two_clients["acme_id"]).status_code == 400
    assert _handover(client, admin, ["TV-LOBBY"], "CL-NOPE").status_code == 400


def test_only_an_administrator_can_hand_screens_over(client, admin, two_clients, lobby):
    assert _handover(client, two_clients["acme"], ["TV-LOBBY"], two_clients["acme_id"]).status_code == 403
    assert client.post("/handover", json={"deviceIds": ["TV-LOBBY"], "clientId": two_clients["acme_id"]}).status_code == 401
    assert client.get("/devices/TV-LOBBY", headers=admin).json()["clientId"] is None
