"""
Covers OTA release durability: APKs must survive a backend redeploy, and the URL handed to
players must be resolved from current configuration rather than frozen at upload time.
"""

import pytest

from app.core.config import settings
from app.services import app_update_service as service_module
from app.services.app_update_service import AppUpdateService


class FakeRemoteProvider:
    """Stands in for Supabase storage so the remote path is exercised without network access."""

    def __init__(self):
        self.uploaded: dict[str, bytes] = {}
        self.deleted: list[str] = []
        self.fail_upload = False

    @property
    def is_remote(self) -> bool:
        return True

    def upload(self, file_obj, filename, content_type, size):
        if self.fail_upload:
            raise RuntimeError("bucket unreachable")
        self.uploaded[filename] = file_obj.read()
        return f"supabase://apks/{filename}"

    def delete(self, storage_uri):
        self.deleted.append(storage_uri)
        return True

    def get_public_url(self, storage_uri, base_url_override=None):
        name = storage_uri.replace("supabase://apks/", "")
        return f"https://example.supabase.co/storage/v1/object/public/apks/{name}"

    def verify_connection(self):
        return None


@pytest.fixture
def remote_storage(monkeypatch):
    provider = FakeRemoteProvider()
    monkeypatch.setattr(service_module, "get_apk_storage_provider", lambda: provider)
    return provider


def _upload(client, version_code, active="true"):
    files = {"file": ("player.apk", b"apk bytes", "application/vnd.android.package-archive")}
    return client.post(
        "/app-updates/",
        files=files,
        data={"version_name": f"v{version_code}", "version_code": str(version_code), "is_active": active},
    )


def test_apk_url_is_recomputed_not_frozen(client, monkeypatch):
    """A release uploaded under one domain must not hand players that old domain forever."""
    monkeypatch.setattr(settings, "API_BASE_URL", "https://old-domain.example")
    created = _upload(client, 4100)
    assert created.status_code == 201
    assert "old-domain.example" in created.json()["apk_url"]

    # The API moves to a new domain; existing releases must follow.
    monkeypatch.setattr(settings, "API_BASE_URL", "https://new-domain.example")
    check = client.get("/app-updates/check?version_code=1")
    assert check.status_code == 200
    assert check.json()["apkUrl"].startswith("https://new-domain.example/")


def test_upload_records_storage_uri_when_remote(client, remote_storage):
    created = _upload(client, 4200)
    assert created.status_code == 201
    body = created.json()
    assert body["storage_uri"] == f"supabase://apks/{body['apk_filename']}"
    assert body["apk_filename"] in remote_storage.uploaded


def test_upload_fails_loudly_when_storage_rejects(client, remote_storage):
    """A silently-local release would vanish on the next redeploy, so the upload must fail."""
    remote_storage.fail_upload = True
    created = _upload(client, 4300)
    assert created.status_code == 502
    assert "object storage" in created.json()["detail"]


def test_download_redirects_to_object_storage(client, remote_storage):
    created = _upload(client, 4400)
    filename = created.json()["apk_filename"]

    res = client.get(f"/app-updates/download/{filename}", follow_redirects=False)
    assert res.status_code == 307
    assert res.headers["location"] == (
        f"https://example.supabase.co/storage/v1/object/public/apks/{filename}"
    )

    # Redirecting must still record the download.
    assert client.get("/app-updates/latest").json()["download_count"] == 1


def test_delete_removes_stored_object(client, remote_storage):
    created = _upload(client, 4500)
    body = created.json()
    assert client.delete(f"/app-updates/{body['id']}").status_code == 204
    assert body["storage_uri"] in remote_storage.deleted


def test_missing_local_file_reports_actionable_error(client):
    """Reproduces the redeploy case: the row survives, the ephemeral file does not."""
    created = _upload(client, 4600)
    filename = created.json()["apk_filename"]
    assert created.json()["storage_uri"] is None  # local provider in the test environment

    AppUpdateService.get_apk_path(filename).unlink()

    res = client.get(f"/app-updates/download/{filename}")
    assert res.status_code == 404
    detail = res.json()["detail"]
    assert "never copied to object storage" in detail
    assert "Re-upload" in detail


def test_download_of_unknown_filename_is_404(client):
    assert client.get("/app-updates/download/player-v1-does-not-exist.apk").status_code == 404
