def test_device_register(client):
    # 1. Register a new device
    payload = {
        "name": "Living Room TV",
        "resolution": "1920x1080",
        "androidId": "test_android_id_123"
    }
    response = client.post("/devices/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "deviceId" in data
    assert "deviceToken" in data

    device_id = data["deviceId"]

    # 2. Re-register the same device with same androidId
    response2 = client.post("/devices/register", json=payload)
    assert response2.status_code == 201
    data2 = response2.json()
    assert data2["deviceId"] == device_id # Should return existing device

def test_current_playlist_empty(client):
    # Unknown devices are rejected rather than given phantom heartbeat state
    response = client.get("/devices/TV-RANDOM/current-playlist")
    assert response.status_code == 404

    # A registered device with no content gets 204 No Content
    reg = client.post("/devices/register", json={
        "name": "Empty TV",
        "resolution": "1920x1080",
        "androidId": "test_android_id_empty"
    })
    assert reg.status_code == 201
    response = client.get(f"/devices/{reg.json()['deviceId']}/current-playlist")
    assert response.status_code == 204
