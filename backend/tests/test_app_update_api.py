def test_create_app_update(client):
    payload = {
        "version_name": "v1.1.0",
        "version_code": 110,
        "apk_filename": "app-v1.1.0.apk",
        "apk_url": "https://grovitai.com/downloads/app-v1.1.0.apk",
        "checksum_sha256": "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        "file_size": 7500000,
        "release_notes": "Added kiosk hardening features.",
        "mandatory": True,
        "is_active": True
    }
    response = client.post("/app-updates/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["version_name"] == "v1.1.0"
    assert data["version_code"] == 110
    assert data["is_active"] is True
    assert "id" in data

def test_create_duplicate_version_code(client):
    payload = {
        "version_name": "v1.1.0",
        "version_code": 110,
        "apk_filename": "app-v1.1.0.apk",
        "apk_url": "https://grovitai.com/downloads/app-v1.1.0.apk",
        "checksum_sha256": "abcdef",
        "file_size": 7500000,
        "is_active": True
    }
    # First post
    response1 = client.post("/app-updates/", json=payload)
    assert response1.status_code == 201
    
    # Second duplicate post should return 400
    response2 = client.post("/app-updates/", json=payload)
    assert response2.status_code == 400

def test_check_for_update_logic(client):
    # Register v1.0.0 (inactive)
    client.post("/app-updates/", json={
        "version_name": "v1.0.0",
        "version_code": 100,
        "apk_filename": "app-v1.0.0.apk",
        "apk_url": "https://grovitai.com/downloads/app-v1.0.0.apk",
        "checksum_sha256": "111111",
        "file_size": 7000000,
        "is_active": False
    })

    # Register v2.0.0 (active)
    client.post("/app-updates/", json={
        "version_name": "v2.0.0",
        "version_code": 200,
        "apk_filename": "app-v2.0.0.apk",
        "apk_url": "https://grovitai.com/downloads/app-v2.0.0.apk",
        "checksum_sha256": "222222",
        "file_size": 7500000,
        "is_active": True
    })

    # Check with client version 100 -> update should be available
    check1 = client.get("/app-updates/check?version_code=100")
    assert check1.status_code == 200
    res1 = check1.json()
    assert res1["update_available"] is True
    assert res1["version_code"] == 200
    assert res1["apk_url"] == "https://grovitai.com/downloads/app-v2.0.0.apk"

    # Check with client version 200 -> no update available
    check2 = client.get("/app-updates/check?version_code=200")
    assert check2.status_code == 200
    res2 = check2.json()
    assert res2["update_available"] is False

    # Check with client version 250 -> no update available
    check3 = client.get("/app-updates/check?version_code=250")
    assert check3.status_code == 200
    res3 = check3.json()
    assert res3["update_available"] is False

def test_activation_exclusivity(client):
    # Register v1.0.0 (active)
    r1 = client.post("/app-updates/", json={
        "version_name": "v1.0.0",
        "version_code": 100,
        "apk_filename": "app-v1.0.0.apk",
        "apk_url": "url1",
        "checksum_sha256": "hash1",
        "file_size": 500,
        "is_active": True
    })
    id1 = r1.json()["id"]

    # Register v2.0.0 (active) - should automatically deactivate v1.0.0
    r2 = client.post("/app-updates/", json={
        "version_name": "v2.0.0",
        "version_code": 200,
        "apk_filename": "app-v2.0.0.apk",
        "apk_url": "url2",
        "checksum_sha256": "hash2",
        "file_size": 600,
        "is_active": True
    })
    id2 = r2.json()["id"]

    # Retrieve all updates and verify is_active states
    updates = client.get("/app-updates/").json()
    v1_item = next(u for u in updates if u["id"] == id1)
    v2_item = next(u for u in updates if u["id"] == id2)
    assert v1_item["is_active"] is False
    assert v2_item["is_active"] is True

    # Activate v1.0.0 manually -> should deactivate v2.0.0
    client.put(f"/app-updates/{id1}/activate")
    updates = client.get("/app-updates/").json()
    v1_item = next(u for u in updates if u["id"] == id1)
    v2_item = next(u for u in updates if u["id"] == id2)
    assert v1_item["is_active"] is True
    assert v2_item["is_active"] is False

def test_delete_app_update(client):
    r = client.post("/app-updates/", json={
        "version_name": "v1.0.0",
        "version_code": 100,
        "apk_filename": "app.apk",
        "apk_url": "url",
        "checksum_sha256": "hash",
        "file_size": 100,
        "is_active": True
    })
    update_id = r.json()["id"]
    
    # Delete update
    del_res = client.delete(f"/app-updates/{update_id}")
    assert del_res.status_code == 204
    
    # Retrieve should not find it
    updates = client.get("/app-updates/").json()
    assert not any(u["id"] == update_id for u in updates)
