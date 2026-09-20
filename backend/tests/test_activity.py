"""
The activity log: what is recorded, what is never recorded, and who may read it.
"""

from app.models.audit_event import AuditEvent
from app.services.audit_service import AuditService, describe_changes
from test_accounts import ADMIN, _device, _media, _playlist, admin, two_clients  # noqa: F401  (fixtures)


def _events(client, headers, **params):
    res = client.get("/activity", params=params, headers=headers)
    assert res.status_code == 200, res.text
    return res.json()["events"]


def _lines(events):
    return [(e["action"], e["entityType"], e["entityName"]) for e in events]


# ── What gets written ───────────────────────────────────────────────────────────────────
def test_changes_are_recorded_with_who_what_and_a_summary(client, admin):
    _device(client, admin, "TV-1")
    media = _media(client, admin, "poster.png")
    playlist = _playlist(client, admin, media["id"], device_ids=["TV-1"], name="Loop").json()
    client.put(f"/playlists/{playlist['id']}", json={"name": "Evening loop", "status": "Draft"}, headers=admin)
    client.put("/devices/TV-1", json={"location": "Lobby"}, headers=admin)
    client.delete(f"/playlists/{playlist['id']}", headers=admin)

    events = _events(client, admin)
    assert _lines(events)[:6] == [
        ("deleted", "playlist", "Evening loop"),
        ("updated", "screen", "TV-1"),
        ("updated", "playlist", "Evening loop"),
        ("created", "playlist", "Loop"),
        ("uploaded", "media", "poster.png"),
        ("created", "screen", "TV-1"),
    ]
    renamed = events[2]
    assert renamed["actorName"] == "Owner" and renamed["actorRole"] == "admin" and renamed["actorKind"] == "user"
    assert renamed["summary"] == "name → Evening loop, status → Draft"
    assert events[1]["summary"] == "location → Lobby"
    assert events[3]["summary"] == "1 item(s), 1 screen(s)"


def test_sign_in_is_recorded_and_a_failed_one_is_not(client, admin):
    client.post("/auth/login", json={"email": ADMIN["email"], "password": "wrong-wrong-wrong"})
    sign_ins = [e for e in _events(client, admin) if e["action"] == "signed_in"]
    assert len(sign_ins) == 1 and sign_ins[0]["entityName"] == ADMIN["email"]


def test_a_password_never_reaches_the_log(client, admin, two_clients, db_session):
    ann = next(u for u in client.get("/users", headers=admin).json() if u["email"] == "ann@acme.test")
    client.put(f"/users/{ann['id']}", json={"password": "a-brand-new-secret-9", "name": "Ann B"}, headers=admin)
    client.post("/auth/password", json={"currentPassword": ADMIN["password"], "newPassword": "another-secret-77"}, headers=admin)

    everything = " ".join(f"{e.summary} {e.entityName} {e.actorName}" for e in db_session.query(AuditEvent).all())
    for secret in ("a-brand-new-secret-9", "another-secret-77", ADMIN["password"], "client-pass-1"):
        assert secret not in everything
    reset = next(e for e in _events(client, admin, entity_type="user") if e["action"] == "updated")
    assert reset["summary"] == "name → Ann B, password reset"


def test_refused_and_failed_requests_leave_no_entry(client, admin, two_clients):
    before = len(_events(client, admin, limit=200))
    _device(client, two_clients["bolt"], "TV-BOLT")
    assert client.put("/devices/TV-BOLT", json={"name": "hijacked"}, headers=two_clients["acme"]).status_code == 404
    assert client.delete("/devices/TV-BOLT", headers=two_clients["acme"]).status_code == 404
    assert client.delete("/playlists/PL-NOPE", headers=admin).status_code == 404
    after = _events(client, admin, limit=200)
    assert len(after) == before + 1 and _lines(after)[0] == ("created", "screen", "TV-BOLT")


def test_a_failure_to_write_the_log_never_fails_the_request(client, admin, monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("audit table is on fire")

    monkeypatch.setattr("app.services.audit_service.AuditEvent", boom)
    res = client.post("/devices", json={"id": "TV-9", "name": "TV-9", "location": "x", "resolution": "1x1", "status": "Offline", "lastSeen": "never", "lastSeenMs": 0}, headers=admin)
    assert res.status_code == 201
    assert client.get("/devices/TV-9", headers=admin).status_code == 200


def test_describe_changes_names_fields_and_hides_noise():
    assert describe_changes({"assignedDeviceIds": ["a"], "items": [], "totalDuration": 30, "updatedAt": 1}) == "screens, sequence"
    assert describe_changes({"isActive": False, "clientId": "CL-1"}) == "active → no, owner"
    assert describe_changes({}) is None


# ── Who may read it ─────────────────────────────────────────────────────────────────────
def test_a_client_sees_only_what_happened_to_their_own_rows(client, admin, two_clients):
    acme, bolt = two_clients["acme"], two_clients["bolt"]
    _device(client, acme, "TV-ACME")
    _device(client, bolt, "TV-BOLT")
    _device(client, admin, "TV-OPERATOR")
    # The operator renames Acme's screen: Acme should be able to see who did that.
    client.put("/devices/TV-ACME", json={"name": "Acme lobby"}, headers=admin)

    seen = _events(client, acme)
    assert {e["entityId"] for e in seen if e["entityType"] == "screen"} == {"TV-ACME"}
    assert any(e["action"] == "updated" and e["actorName"] == "Owner" for e in seen)
    assert all(e["clientId"] == two_clients["acme_id"] for e in seen)
    # Accounts and other clients are not theirs to read, with or without filters.
    assert not [e for e in seen if e["entityType"] in ("user", "client", "release")]
    assert _events(client, acme, entity_id="TV-BOLT") == []
    assert _events(client, acme, entity_type="user") == []


def test_handover_is_filed_under_the_client_who_gains_or_loses_the_screen(client, admin, two_clients):
    _device(client, admin, "TV-LOBBY")
    client.post("/handover", json={"deviceIds": ["TV-LOBBY"], "clientId": two_clients["acme_id"]}, headers=admin)
    gained = [e for e in _events(client, two_clients["acme"]) if e["action"] == "handed_over"]
    assert len(gained) == 1 and gained[0]["summary"].startswith("to Acme")

    client.post("/handover", json={"deviceIds": ["TV-LOBBY"], "clientId": None}, headers=admin)
    lost = [e for e in _events(client, two_clients["acme"]) if e["action"] == "handed_over"]
    assert len(lost) == 2 and lost[0]["summary"].startswith("to the operator")
    # A dry run changes nothing and records nothing.
    client.post("/handover", json={"deviceIds": ["TV-LOBBY"], "clientId": two_clients["bolt_id"], "dryRun": True}, headers=admin)
    assert _events(client, two_clients["bolt"]) == [e for e in _events(client, two_clients["bolt"]) if e["action"] == "signed_in"]


def test_administrator_sees_everything_and_can_narrow_it(client, admin, two_clients):
    _device(client, two_clients["acme"], "TV-ACME")
    everything = _events(client, admin, limit=200)
    assert {"user", "client", "screen", "account"} <= {e["entityType"] for e in everything}
    scoped = _events(client, {**admin, "X-Client-Scope": two_clients["acme_id"]}, limit=200)
    assert scoped and all(e["clientId"] == two_clients["acme_id"] for e in scoped)
    assert [e["entityId"] for e in _events(client, admin, entity_id="TV-ACME")] == ["TV-ACME"]


def test_pages_run_newest_first_without_gaps_or_repeats(client, admin):
    for i in range(7):
        _device(client, admin, f"TV-{i}")
    first = client.get("/activity", params={"limit": 3, "entity_type": "screen"}, headers=admin).json()
    second = client.get("/activity", params={"limit": 3, "entity_type": "screen", "before": first["nextBefore"]}, headers=admin).json()
    third = client.get("/activity", params={"limit": 3, "entity_type": "screen", "before": second["nextBefore"]}, headers=admin).json()
    ids = [e["entityId"] for page in (first, second, third) for e in page["events"]]
    assert ids == [f"TV-{i}" for i in range(6, -1, -1)]
    assert third["nextBefore"] is None


def test_the_log_needs_a_sign_in(client, admin):
    assert client.get("/activity").status_code == 401


def test_entries_made_before_sign_in_say_so(client):
    _device(client, {}, "TV-EARLY")
    event = _events(client, {})[0]
    assert event["actorKind"] == "open" and "sign-in was off" in event["actorName"]
    assert AuditService is not None
