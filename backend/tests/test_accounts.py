"""
User accounts and per-client separation.

Three contracts are covered here:

* nothing changes until the first account exists, so an upgrade never locks a deployment out;
* once accounts exist, every CMS route needs a sign-in and a client only ever sees its own rows;
* the operator cannot lock themselves out (first account, last administrator, own account).
"""

import time

import pytest

from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.models.user import UserSession

ADMIN = {"email": "owner@example.com", "name": "Owner", "password": "correct-horse-1", "role": "admin"}


# ── helpers ─────────────────────────────────────────────────────────────────────────────
def _bearer(token):
    return {"Authorization": f"Bearer {token}"}


def _login(client, email, password):
    res = client.post("/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()


@pytest.fixture
def admin(client):
    """Creates the first administrator (allowed anonymously while no account exists) and signs in."""
    assert client.post("/users", json=ADMIN).status_code == 201
    return _bearer(_login(client, ADMIN["email"], ADMIN["password"])["token"])


def _make_client_user(client, admin, company, email):
    company_id = client.post("/clients", json={"name": company}, headers=admin).json()["id"]
    res = client.post(
        "/users",
        json={"email": email, "name": f"{company} user", "password": "client-pass-1", "role": "client", "clientId": company_id},
        headers=admin,
    )
    assert res.status_code == 201, res.text
    return company_id, _bearer(_login(client, email, "client-pass-1")["token"])


@pytest.fixture
def two_clients(client, admin):
    acme_id, acme = _make_client_user(client, admin, "Acme", "ann@acme.test")
    bolt_id, bolt = _make_client_user(client, admin, "Bolt", "bob@bolt.test")
    return {"acme_id": acme_id, "acme": acme, "bolt_id": bolt_id, "bolt": bolt}


def _device(client, headers, device_id):
    res = client.post(
        "/devices",
        json={"id": device_id, "name": device_id, "location": "Lobby", "resolution": "1920x1080", "status": "Offline", "lastSeen": "never", "lastSeenMs": 0},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()


def _media(client, headers, name="poster.png"):
    # 1x1 PNG
    png = bytes.fromhex(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082"
    )
    res = client.post("/media/upload", files={"file": (name, png, "image/png")}, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


def _playlist(client, headers, media_id, device_ids=(), name="Loop", status="Published"):
    res = client.post(
        "/playlists",
        json={
            "name": name,
            "description": "",
            "status": status,
            "totalDuration": 10,
            "updatedAt": 0,
            "items": [{"id": f"ITEM-{time.time_ns()}", "mediaId": media_id, "duration": 10}],
            "assignedDeviceIds": list(device_ids),
        },
        headers=headers,
    )
    return res


# ── Passwords ───────────────────────────────────────────────────────────────────────────
def test_password_hash_round_trip():
    stored = hash_password("s3cret-value")
    assert stored.startswith("scrypt$") and "s3cret-value" not in stored
    assert verify_password("s3cret-value", stored)
    assert not verify_password("s3cret-valuE", stored)
    assert not verify_password("anything", "not-a-hash")


# ── Nothing changes until the first account exists ──────────────────────────────────────
def test_api_stays_open_until_an_account_exists(client):
    assert client.get("/auth/status").json() == {"loginRequired": False}
    assert client.get("/devices").status_code == 200
    assert client.get("/users").status_code == 200


def test_first_account_must_be_an_administrator(client):
    res = client.post("/users", json={**ADMIN, "role": "client"})
    assert res.status_code == 400
    assert client.get("/auth/status").json() == {"loginRequired": False}


def test_creating_the_first_admin_turns_sign_in_on(client):
    assert client.post("/users", json=ADMIN).status_code == 201
    assert client.get("/auth/status").json() == {"loginRequired": True}
    for path in ("/devices", "/media", "/playlists", "/schedules", "/users", "/clients", "/app-updates/"):
        assert client.get(path).status_code == 401, path


def test_players_are_unaffected_by_accounts(client, admin):
    """Screens have no user account. Registration, heartbeat and playlist polling must keep working."""
    body = client.post("/devices/register", json={"name": "Lobby TV", "resolution": "1920x1080", "androidId": "tv-1"}).json()
    assert client.post("/devices/heartbeat", json={"deviceId": body["deviceId"]}).status_code == 200
    assert client.get(f"/devices/{body['deviceId']}/current-playlist").status_code == 204
    assert client.get("/app-updates/check?version_code=1").status_code == 200


# ── Sign-in ─────────────────────────────────────────────────────────────────────────────
def test_login_returns_a_working_token(client, admin):
    me = client.get("/auth/me", headers=admin)
    assert me.status_code == 200
    assert me.json()["email"] == ADMIN["email"] and me.json()["role"] == "admin"
    assert "passwordHash" not in me.json()


def test_login_rejects_bad_credentials_with_one_message(client, admin):
    wrong = client.post("/auth/login", json={"email": ADMIN["email"], "password": "nope-nope-nope"})
    unknown = client.post("/auth/login", json={"email": "ghost@example.com", "password": "nope-nope-nope"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json()["detail"] == unknown.json()["detail"]


def test_login_is_case_insensitive_on_email(client, admin):
    assert client.post("/auth/login", json={"email": "OWNER@Example.com", "password": ADMIN["password"]}).status_code == 200


def test_login_is_throttled_after_repeated_failures(client, admin):
    for _ in range(5):
        assert client.post("/auth/login", json={"email": ADMIN["email"], "password": "wrong-wrong"}).status_code == 401
    blocked = client.post("/auth/login", json={"email": ADMIN["email"], "password": ADMIN["password"]})
    assert blocked.status_code == 429
    assert int(blocked.headers["retry-after"]) > 0


def test_logout_ends_the_session(client, admin):
    assert client.post("/auth/logout", headers=admin).status_code == 204
    assert client.get("/auth/me", headers=admin).status_code == 401


def test_expired_session_is_rejected(client, admin, db_session):
    db_session.query(UserSession).update({"expiresAt": 1})
    db_session.commit()
    assert client.get("/devices", headers=admin).status_code == 401


def test_session_token_is_not_stored_in_the_database(client, admin, db_session):
    token = admin["Authorization"].split(" ", 1)[1]
    stored = [s.tokenHash for s in db_session.query(UserSession).all()]
    assert stored and token not in stored


def test_changing_password_signs_out_other_sessions(client, admin):
    second = _bearer(_login(client, ADMIN["email"], ADMIN["password"])["token"])
    res = client.post("/auth/password", json={"currentPassword": ADMIN["password"], "newPassword": "brand-new-pass-2"}, headers=admin)
    assert res.status_code == 204
    assert client.get("/auth/me", headers=admin).status_code == 200  # the session that made the change survives
    assert client.get("/auth/me", headers=second).status_code == 401
    assert client.post("/auth/login", json={"email": ADMIN["email"], "password": "brand-new-pass-2"}).status_code == 200


def test_changing_password_needs_the_current_one(client, admin):
    res = client.post("/auth/password", json={"currentPassword": "guess-guess", "newPassword": "brand-new-pass-2"}, headers=admin)
    assert res.status_code == 400


def test_admin_key_still_works_alongside_accounts(client, admin, monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_API_KEY", "support-tooling-key")
    assert client.get("/devices", headers={"X-Admin-Key": "support-tooling-key"}).status_code == 200
    assert client.get("/users", headers={"X-Admin-Key": "support-tooling-key"}).status_code == 200
    assert client.get("/devices", headers={"X-Admin-Key": "wrong"}).status_code == 401


# ── Administrator-only areas ────────────────────────────────────────────────────────────
def test_client_users_cannot_reach_admin_areas(client, two_clients):
    acme = two_clients["acme"]
    assert client.get("/users", headers=acme).status_code == 403
    assert client.get("/clients", headers=acme).status_code == 403
    assert client.get("/app-updates/", headers=acme).status_code == 403
    assert client.post("/users", json={**ADMIN, "email": "evil@acme.test"}, headers=acme).status_code == 403


def test_client_user_needs_a_client_and_admin_has_none(client, admin):
    orphan = client.post("/users", json={"email": "x@y.test", "name": "X", "password": "client-pass-1", "role": "client"}, headers=admin)
    assert orphan.status_code == 400

    company_id = client.post("/clients", json={"name": "Acme"}, headers=admin).json()["id"]
    second_admin = client.post(
        "/users",
        json={"email": "ops@example.com", "name": "Ops", "password": "client-pass-1", "role": "admin", "clientId": company_id},
        headers=admin,
    )
    assert second_admin.status_code == 201
    assert second_admin.json()["clientId"] is None


def test_duplicate_email_is_refused(client, admin):
    assert client.post("/users", json={**ADMIN, "email": "Owner@Example.com"}, headers=admin).status_code == 409


# ── Lock-out guards ─────────────────────────────────────────────────────────────────────
def test_last_admin_cannot_be_removed_disabled_or_demoted(client, admin):
    me = client.get("/auth/me", headers=admin).json()
    assert client.delete(f"/users/{me['id']}", headers=admin).status_code == 409
    assert client.put(f"/users/{me['id']}", json={"isActive": False}, headers=admin).status_code == 409
    assert client.put(f"/users/{me['id']}", json={"role": "client"}, headers=admin).status_code == 409


def test_admin_cannot_remove_their_own_access_even_with_another_admin(client, admin):
    client.post("/users", json={**ADMIN, "email": "second@example.com"}, headers=admin)
    me = client.get("/auth/me", headers=admin).json()
    assert client.delete(f"/users/{me['id']}", headers=admin).status_code == 409


def test_disabling_a_user_signs_them_out(client, admin, two_clients):
    users = client.get("/users", headers=admin).json()
    ann = next(u for u in users if u["email"] == "ann@acme.test")
    assert client.get("/devices", headers=two_clients["acme"]).status_code == 200
    assert client.put(f"/users/{ann['id']}", json={"isActive": False}, headers=admin).status_code == 200
    assert client.get("/devices", headers=two_clients["acme"]).status_code == 401
    assert client.post("/auth/login", json={"email": "ann@acme.test", "password": "client-pass-1"}).status_code == 401


def test_admin_password_reset_signs_the_user_out(client, admin, two_clients):
    ann = next(u for u in client.get("/users", headers=admin).json() if u["email"] == "ann@acme.test")
    assert client.put(f"/users/{ann['id']}", json={"password": "reset-by-admin-9"}, headers=admin).status_code == 200
    assert client.get("/devices", headers=two_clients["acme"]).status_code == 401
    assert client.post("/auth/login", json={"email": "ann@acme.test", "password": "reset-by-admin-9"}).status_code == 200


def test_client_with_content_cannot_be_deleted(client, admin, two_clients):
    res = client.delete(f"/clients/{two_clients['acme_id']}", headers=admin)
    assert res.status_code == 409 and "1 user" in res.json()["detail"]

    empty = client.post("/clients", json={"name": "Empty Co"}, headers=admin).json()["id"]
    assert client.delete(f"/clients/{empty}", headers=admin).status_code == 204


def test_client_names_are_unique_ignoring_case(client, admin):
    assert client.post("/clients", json={"name": "Acme"}, headers=admin).status_code == 201
    assert client.post("/clients", json={"name": "ACME"}, headers=admin).status_code == 409


# ── Separation between clients ──────────────────────────────────────────────────────────
def test_each_client_sees_only_its_own_rows(client, admin, two_clients):
    acme, bolt = two_clients["acme"], two_clients["bolt"]
    _device(client, acme, "TV-ACME")
    _device(client, bolt, "TV-BOLT")
    _device(client, admin, "TV-OPERATOR")
    acme_media = _media(client, acme, "acme.png")
    _media(client, bolt, "bolt.png")

    assert [d["id"] for d in client.get("/devices", headers=acme).json()] == ["TV-ACME"]
    assert [d["id"] for d in client.get("/devices", headers=bolt).json()] == ["TV-BOLT"]
    assert {d["id"] for d in client.get("/devices", headers=admin).json()} == {"TV-ACME", "TV-BOLT", "TV-OPERATOR"}

    assert [m["name"] for m in client.get("/media", headers=acme).json()] == ["acme.png"]
    assert acme_media["clientId"] == two_clients["acme_id"]
    assert acme_media["uploadedBy"] == "Acme user"


def test_another_clients_rows_look_like_they_do_not_exist(client, two_clients):
    acme, bolt = two_clients["acme"], two_clients["bolt"]
    _device(client, bolt, "TV-BOLT")
    bolt_media = _media(client, bolt)

    assert client.get("/devices/TV-BOLT", headers=acme).status_code == 404
    assert client.put("/devices/TV-BOLT", json={"name": "hijacked"}, headers=acme).status_code == 404
    assert client.delete("/devices/TV-BOLT", headers=acme).status_code == 404
    assert client.get(f"/media/{bolt_media['id']}", headers=acme).status_code == 404
    assert client.delete(f"/media/{bolt_media['id']}", headers=acme).status_code == 404
    # ... and it is all still there for its owner.
    assert client.get("/devices/TV-BOLT", headers=bolt).json()["name"] == "TV-BOLT"


def test_client_cannot_build_on_another_clients_media_or_screens(client, two_clients):
    acme, bolt = two_clients["acme"], two_clients["bolt"]
    _device(client, bolt, "TV-BOLT")
    bolt_media = _media(client, bolt)
    acme_media = _media(client, acme)

    assert _playlist(client, acme, bolt_media["id"]).status_code == 400
    assert _playlist(client, acme, acme_media["id"], device_ids=["TV-BOLT"]).status_code == 400

    bolt_playlist = _playlist(client, bolt, bolt_media["id"]).json()
    _device(client, acme, "TV-ACME")
    schedule = {
        "name": "Hijack", "playlistId": bolt_playlist["id"], "startDate": "2030-01-01", "endDate": "2030-01-02",
        "startTime": "09:00:00", "endTime": "17:00:00", "repeat": "Daily", "priority": "Normal", "status": "Active",
        "deviceIds": ["TV-ACME"],
    }
    assert client.post("/schedules", json=schedule, headers=acme).status_code == 400
    assert client.get(f"/playlists/{bolt_playlist['id']}", headers=acme).status_code == 404


def test_client_cannot_move_rows_to_another_client(client, two_clients):
    _device(client, two_clients["acme"], "TV-ACME")
    res = client.put("/devices/TV-ACME", json={"clientId": two_clients["bolt_id"], "name": "Renamed"}, headers=two_clients["acme"])
    assert res.status_code == 200
    assert res.json()["name"] == "Renamed"
    assert res.json()["clientId"] == two_clients["acme_id"]


def test_admin_hands_a_self_registered_screen_to_a_client(client, admin, two_clients):
    device_id = client.post("/devices/register", json={"name": "New TV", "resolution": "1920x1080", "androidId": "tv-9"}).json()["deviceId"]
    assert client.get(f"/devices/{device_id}", headers=admin).json()["clientId"] is None
    assert client.get("/devices", headers=two_clients["acme"]).json() == []

    res = client.put(f"/devices/{device_id}", json={"clientId": two_clients["acme_id"]}, headers=admin)
    assert res.status_code == 200 and res.json()["clientId"] == two_clients["acme_id"]
    assert [d["id"] for d in client.get("/devices", headers=two_clients["acme"]).json()] == [device_id]

    assert client.put(f"/devices/{device_id}", json={"clientId": "CL-NOPE"}, headers=admin).status_code == 400
    # null hands it back to the operator
    assert client.put(f"/devices/{device_id}", json={"clientId": None}, headers=admin).json()["clientId"] is None


def test_admin_client_switcher_scopes_lists_and_new_rows(client, admin, two_clients):
    _device(client, two_clients["acme"], "TV-ACME")
    _device(client, two_clients["bolt"], "TV-BOLT")
    as_acme = {**admin, "X-Client-Scope": two_clients["acme_id"]}

    assert [d["id"] for d in client.get("/devices", headers=as_acme).json()] == ["TV-ACME"]
    assert _media(client, as_acme)["clientId"] == two_clients["acme_id"]
    # Lookups by id stay unrestricted for an administrator.
    assert client.get("/devices/TV-BOLT", headers=as_acme).status_code == 200
    assert client.get("/devices", headers={**admin, "X-Client-Scope": "CL-NOPE"}).status_code == 400


def test_scope_header_cannot_widen_a_client_users_view(client, two_clients):
    _device(client, two_clients["bolt"], "TV-BOLT")
    sneaky = {**two_clients["acme"], "X-Client-Scope": two_clients["bolt_id"]}
    assert client.get("/devices", headers=sneaky).json() == []


def test_player_still_receives_a_clients_playlist(client, two_clients):
    """Ownership is a CMS concept; what a screen plays is resolved exactly as before."""
    acme = two_clients["acme"]
    _device(client, acme, "TV-ACME")
    media = _media(client, acme)
    assert _playlist(client, acme, media["id"], device_ids=["TV-ACME"]).status_code == 201
    res = client.get("/devices/TV-ACME/current-playlist")
    assert res.status_code == 200 and res.json()["items"][0]["mediaId"] == media["id"]


def test_assigning_a_playlist_takes_the_screen_off_every_other_playlist(client, admin, two_clients):
    """A client cannot see an administrator's playlist, so the server has to do the tidying up."""
    acme = two_clients["acme"]
    _device(client, acme, "TV-ACME")
    operator_media = _media(client, admin)
    operator_playlist = _playlist(client, admin, operator_media["id"], device_ids=["TV-ACME"], name="Operator loop").json()

    acme_media = _media(client, acme)
    acme_playlist = _playlist(client, acme, acme_media["id"], device_ids=["TV-ACME"], name="Acme loop").json()

    assert client.get(f"/playlists/{operator_playlist['id']}", headers=admin).json()["assignedDeviceIds"] == []
    assert client.get(f"/playlists/{acme_playlist['id']}", headers=admin).json()["assignedDeviceIds"] == ["TV-ACME"]
    assert client.get("/devices/TV-ACME/current-playlist").json()["playlistId"] == acme_playlist["id"]


# ── First administrator from the environment ────────────────────────────────────────────
def test_bootstrap_admin_is_created_once_and_never_again(client, db_session, monkeypatch):
    from app.services.account_service import AccountService

    monkeypatch.setattr(settings, "BOOTSTRAP_ADMIN_EMAIL", "Boot@Example.com")
    monkeypatch.setattr(settings, "BOOTSTRAP_ADMIN_PASSWORD", "bootstrap-pass-1")
    AccountService.bootstrap_admin(db_session)
    assert client.post("/auth/login", json={"email": "boot@example.com", "password": "bootstrap-pass-1"}).status_code == 200

    # A later start with a different password must not reset the account.
    monkeypatch.setattr(settings, "BOOTSTRAP_ADMIN_PASSWORD", "attacker-chosen-1")
    AccountService.bootstrap_admin(db_session)
    assert client.post("/auth/login", json={"email": "boot@example.com", "password": "attacker-chosen-1"}).status_code == 401


def test_bootstrap_ignores_a_weak_password(client, db_session, monkeypatch):
    from app.services.account_service import AccountService

    monkeypatch.setattr(settings, "BOOTSTRAP_ADMIN_EMAIL", "boot@example.com")
    monkeypatch.setattr(settings, "BOOTSTRAP_ADMIN_PASSWORD", "short")
    AccountService.bootstrap_admin(db_session)
    assert client.get("/auth/status").json() == {"loginRequired": False}
