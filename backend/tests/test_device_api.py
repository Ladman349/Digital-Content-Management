def test_create_device(client):
    payload = {
        "name": "Test Screen",
        "location": "Lobby",
        "resolution": "1920x1080",
        "status": "Online",
        "lastSeen": "Just now",
        "lastSeenMs": 1600000000,
        "ipAddress": "192.168.1.10",
        "storage": "50GB Free"
    }
    response = client.post("/devices", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Screen"
    assert "id" in data
    assert data["id"].startswith("TV-")

def test_get_devices(client):
    client.post("/devices", json={
        "name": "Screen 1", "location": "A", "resolution": "1080p", 
        "status": "Online", "lastSeen": "now", "lastSeenMs": 123
    })
    response = client.get("/devices")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["name"] == "Screen 1"

def test_update_device(client):
    create_response = client.post("/devices", json={
        "name": "Screen To Update", "location": "A", "resolution": "1080p", 
        "status": "Offline", "lastSeen": "now", "lastSeenMs": 123
    })
    device_id = create_response.json()["id"]
    
    update_response = client.put(f"/devices/{device_id}", json={
        "status": "Online"
    })
    assert update_response.status_code == 200
    assert update_response.json()["status"] == "Online"

def test_delete_device(client):
    create_response = client.post("/devices", json={
        "name": "Screen To Delete", "location": "A", "resolution": "1080p", 
        "status": "Offline", "lastSeen": "now", "lastSeenMs": 123
    })
    device_id = create_response.json()["id"]
    
    del_response = client.delete(f"/devices/{device_id}")
    assert del_response.status_code == 204
    
    get_response = client.get(f"/devices")
    assert len([d for d in get_response.json() if d["id"] == device_id]) == 0

import time
from app.services.device_service import DeviceService

def test_device_heartbeat(client):
    # Create device
    payload = {
        "name": "Heartbeat Device",
        "location": "Lobby",
        "resolution": "1080p",
        "status": "Offline",
        "lastSeen": "now",
        "lastSeenMs": 123
    }
    create_res = client.post("/devices", json=payload)
    device_id = create_res.json()["id"]

    # Send heartbeat
    hb_payload = {
        "deviceId": device_id,
        "storageUsed": 62.5,
        "storageTotal": 128.0,
        "currentPlaylistId": "playlist_123",
        "currentMediaId": "media_456",
        "appVersion": "1.0.0",
        "uptimeSeconds": 86400,
        "ipAddress": "192.168.1.50"
    }
    hb_res = client.post("/devices/heartbeat", json=hb_payload)
    assert hb_res.status_code == 200
    data = hb_res.json()
    assert data["status"] == "Online"
    assert data["storageUsed"] == 62.5
    assert data["storageTotal"] == 128.0
    assert data["currentPlaylistId"] == "playlist_123"
    assert data["currentMediaId"] == "media_456"
    assert data["appVersion"] == "1.0.0"
    assert data["uptimeSeconds"] == 86400
    assert data["ipAddress"] == "192.168.1.50"
    assert "heartbeatAt" in data

def test_heartbeat_invalid_device(client):
    hb_payload = {
        "deviceId": "NONEXISTENT",
        "storageUsed": 62.5,
        "storageTotal": 128.0
    }
    hb_res = client.post("/devices/heartbeat", json=hb_payload)
    assert hb_res.status_code == 404

def test_device_status_transitions(client):
    create_res = client.post("/devices", json={
        "name": "Status Device", "location": "Lobby", "resolution": "1080p", 
        "status": "Offline", "lastSeen": "now", "lastSeenMs": 123
    })
    device_id = create_res.json()["id"]

    # Offline transition (No heartbeat yet)
    status_res = client.get(f"/devices/{device_id}/status")
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "Offline"

    # Online transition
    client.post("/devices/heartbeat", json={"deviceId": device_id})
    status_res2 = client.get(f"/devices/{device_id}/status")
    assert status_res2.json()["status"] == "Online"

    # Force heartbeat to be 120 seconds ago (Idle transition)
    # Since we can't easily mock time.time() in a black-box test without patching,
    # we'll test the calculate_status function directly
    
    current_time = int(time.time() * 1000)
    
    # 30 seconds ago -> Online
    assert DeviceService.calculate_status(current_time - 30 * 1000) == "Online"
    
    # 120 seconds ago -> Idle
    assert DeviceService.calculate_status(current_time - 120 * 1000) == "Idle"
    
    # 400 seconds ago -> Offline
    assert DeviceService.calculate_status(current_time - 400 * 1000) == "Offline"

def test_repeated_heartbeats(client):
    create_res = client.post("/devices", json={
        "name": "Repeat Device", "location": "Lobby", "resolution": "1080p", 
        "status": "Offline", "lastSeen": "now", "lastSeenMs": 123
    })
    device_id = create_res.json()["id"]
    
    hb1 = client.post("/devices/heartbeat", json={"deviceId": device_id, "uptimeSeconds": 10})
    assert hb1.json()["uptimeSeconds"] == 10
    
    hb2 = client.post("/devices/heartbeat", json={"deviceId": device_id, "uptimeSeconds": 20})
    assert hb2.json()["uptimeSeconds"] == 20
    
    assert hb2.json()["heartbeatAt"] >= hb1.json()["heartbeatAt"]

