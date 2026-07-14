def test_create_app_update(client):
    file_content = b"fake apk content"
    files = {"file": ("app-release.apk", file_content, "application/vnd.android.package-archive")}
    data = {
        "version_name": "v1.1.0",
        "version_code": "110",
        "mandatory": "true",
        "is_active": "true",
        "release_notes": "Added kiosk features"
    }
    response = client.post("/app-updates/", files=files, data=data)
    assert response.status_code == 201
    res = response.json()
    assert res["version_name"] == "v1.1.0"
    assert res["version_code"] == 110
    assert res["is_active"] is True
    assert res["download_count"] == 0
    assert "id" in res
    assert "checksum_sha256" in res
    assert res["file_size"] == len(file_content)

def test_create_duplicate_version_code(client):
    file_content = b"fake apk content"
    files1 = {"file": ("app-v1.apk", file_content, "application/vnd.android.package-archive")}
    data1 = {
        "version_name": "v1.1.0",
        "version_code": "111",
        "is_active": "true"
    }
    res1 = client.post("/app-updates/", files=files1, data=data1)
    assert res1.status_code == 201

    # Duplicate post should return 409 Conflict
    files2 = {"file": ("app-v1-dup.apk", file_content, "application/vnd.android.package-archive")}
    data2 = {
        "version_name": "v1.1.0-dup",
        "version_code": "111",
        "is_active": "false"
    }
    res2 = client.post("/app-updates/", files=files2, data=data2)
    assert res2.status_code == 409
    assert "already exists" in res2.json()["detail"]

def test_invalid_file_type(client):
    file_content = b"fake image"
    files = {"file": ("test.jpg", file_content, "image/jpeg")}
    data = {
        "version_name": "v1.2.0",
        "version_code": "120"
    }
    res = client.post("/app-updates/", files=files, data=data)
    assert res.status_code == 400
    assert "Only .apk files are allowed" in res.json()["detail"]

def test_check_for_update_logic(client):
    # Register v1.0.0 (inactive)
    f1 = {"file": ("v1.apk", b"v1 content", "application/vnd.android.package-archive")}
    client.post("/app-updates/", files=f1, data={
        "version_name": "v1.0.0",
        "version_code": "100",
        "is_active": "false"
    })

    # Register v2.0.0 (active)
    f2 = {"file": ("v2.apk", b"v2 content", "application/vnd.android.package-archive")}
    client.post("/app-updates/", files=f2, data={
        "version_name": "v2.0.0",
        "version_code": "200",
        "is_active": "true",
        "release_notes": "Major update"
    })

    # Check with client version 100 -> update available in camelCase
    check1 = client.get("/app-updates/check?version_code=100")
    assert check1.status_code == 200
    res1 = check1.json()
    assert res1["updateAvailable"] is True
    assert res1["latestVersionCode"] == 200
    assert "apkUrl" in res1
    assert "checksum" in res1
    assert res1["releaseNotes"] == "Major update"

    # Check with client version 200 -> no update
    check2 = client.get("/app-updates/check?version_code=200")
    assert check2.status_code == 200
    res2 = check2.json()
    assert res2["updateAvailable"] is False

def test_download_and_metrics(client):
    file_content = b"fake download test binary content"
    files = {"file": ("download.apk", file_content, "application/vnd.android.package-archive")}
    data = {
        "version_name": "v1.3.0",
        "version_code": "130",
        "is_active": "true"
    }
    create_res = client.post("/app-updates/", files=files, data=data)
    assert create_res.status_code == 201
    filename = create_res.json()["apk_filename"]
    
    # Verify download count starts at 0
    assert create_res.json()["download_count"] == 0

    # Download file
    dl_res = client.get(f"/app-updates/download/{filename}")
    assert dl_res.status_code == 200
    assert dl_res.content == file_content
    assert "attachment" in dl_res.headers["content-disposition"]
    assert filename in dl_res.headers["content-disposition"]
    # Check cache control headers
    assert "no-cache" in dl_res.headers["cache-control"]
    assert "no-store" in dl_res.headers["cache-control"]
    assert dl_res.headers["pragma"] == "no-cache"
    assert dl_res.headers["expires"] == "0"

    # Verify download count incremented
    latest_meta = client.get("/app-updates/latest").json()
    assert latest_meta["download_count"] == 1
    assert latest_meta["last_downloaded_at"] is not None

def test_activation_exclusivity(client):
    # Register v1.0.0 (active)
    f1 = {"file": ("v1.apk", b"v1", "application/vnd.android.package-archive")}
    r1 = client.post("/app-updates/", files=f1, data={
        "version_name": "v1.0.0",
        "version_code": "1000",
        "is_active": "true"
    })
    id1 = r1.json()["id"]

    # Register v2.0.0 (active) -> deactivates v1.0.0
    f2 = {"file": ("v2.apk", b"v2", "application/vnd.android.package-archive")}
    r2 = client.post("/app-updates/", files=f2, data={
        "version_name": "v2.0.0",
        "version_code": "2000",
        "is_active": "true"
    })
    id2 = r2.json()["id"]

    # Verify states
    updates = client.get("/app-updates/").json()
    v1_item = next(u for u in updates if u["id"] == id1)
    v2_item = next(u for u in updates if u["id"] == id2)
    assert v1_item["is_active"] is False
    assert v2_item["is_active"] is True

    # Activate v1 manually -> deactivates v2
    client.put(f"/app-updates/{id1}/activate")
    updates = client.get("/app-updates/").json()
    v1_item = next(u for u in updates if u["id"] == id1)
    v2_item = next(u for u in updates if u["id"] == id2)
    assert v1_item["is_active"] is True
    assert v2_item["is_active"] is False

def test_delete_app_update(client):
    f = {"file": ("del.apk", b"del", "application/vnd.android.package-archive")}
    r = client.post("/app-updates/", files=f, data={
        "version_name": "v1.0.0",
        "version_code": "9999",
        "is_active": "true"
    })
    update_id = r.json()["id"]

    del_res = client.delete(f"/app-updates/{update_id}")
    assert del_res.status_code == 204

    # Verify metadata deleted
    updates = client.get("/app-updates/").json()
    assert not any(u["id"] == update_id for u in updates)

def test_ping_updates(client):
    res = client.get("/app-updates/ping")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}

def test_info_endpoint(client):
    # Ensure there is an active release
    f = {"file": ("info.apk", b"info content", "application/vnd.android.package-archive")}
    client.post("/app-updates/", files=f, data={
        "version_name": "1.0.15",
        "version_code": "15",
        "is_active": "true",
        "mandatory": "false"
    })

    res = client.get("/app-updates/info")
    assert res.status_code == 200
    data = res.json()
    assert data["versionName"] == "1.0.15"
    assert data["versionCode"] == 15
    assert data["mandatory"] is False
    assert data["downloadCount"] == 0
    assert data["fileSize"] == len(b"info content")
    assert "checksum" in data
    assert "uploadedAt" in data
