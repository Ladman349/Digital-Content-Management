import pytest

def test_create_schedule(client):
    # Setup Device
    device_res = client.post("/devices", json={
        "name": "Sch Device",
        "location": "Lobby",
        "resolution": "1920x1080",
        "status": "Online",
        "lastSeen": "now",
        "lastSeenMs": 123
    })
    device_id = device_res.json()["id"]

    # Upload Media
    file_content = b"fake image"
    media_res = client.post("/media/upload", files={"file": ("test.jpg", file_content, "image/jpeg")})
    media_id = media_res.json()["id"]

    # Setup Playlist
    playlist_res = client.post("/playlists", json={
        "name": "Sch Playlist",
        "description": "Test",
        "status": "Draft",
        "totalDuration": 10,
        "updatedAt": 12345,
        "items": [
            {
                "id": "item-1",
                "mediaId": media_id,
                "duration": 10
            }
        ],
        "assignedDeviceIds": []
    })
    playlist_id = playlist_res.json()["id"]

    # Create Schedule
    payload = {
        "name": "Morning Schedule",
        "playlistId": playlist_id,
        "deviceIds": [device_id],
        "startDate": "2026-07-01",
        "endDate": "2026-07-31",
        "startTime": "08:00",
        "endTime": "12:00",
        "repeat": "Daily",
        "priority": "Normal",
        "status": "Active"
    }

    res = client.post("/schedules", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Morning Schedule"
    assert data["playlistId"] == playlist_id
    assert len(data["deviceIds"]) == 1
    assert data["deviceIds"][0] == device_id

def test_schedule_conflicts(client):
    # Use existing device and playlist for simplicity (we assume test DB persists between functions or we recreate)
    device_res = client.post("/devices", json={
        "name": "Sch Device 2",
        "location": "Lobby",
        "resolution": "1920x1080",
        "status": "Online",
        "lastSeen": "now",
        "lastSeenMs": 123
    })
    device_id = device_res.json()["id"]

    file_content = b"fake image"
    media_res = client.post("/media/upload", files={"file": ("test2.jpg", file_content, "image/jpeg")})
    media_id = media_res.json()["id"]

    playlist_res = client.post("/playlists", json={
        "name": "Sch Playlist 2",
        "description": "Test",
        "status": "Draft",
        "totalDuration": 10,
        "updatedAt": 12345,
        "items": [
            {
                "id": "item-1",
                "mediaId": media_id,
                "duration": 10
            }
        ],
        "assignedDeviceIds": []
    })
    playlist_id = playlist_res.json()["id"]

    # Existing schedule
    payload1 = {
        "name": "Morning",
        "playlistId": playlist_id,
        "deviceIds": [device_id],
        "startDate": "2026-07-01",
        "endDate": "2026-07-31",
        "startTime": "08:00",
        "endTime": "12:00",
        "repeat": "Daily",
        "priority": "Normal",
        "status": "Active"
    }
    client.post("/schedules", json=payload1)

    # Overlapping schedule with SAME priority (should fail)
    payload2 = {
        "name": "Overlap",
        "playlistId": playlist_id,
        "deviceIds": [device_id],
        "startDate": "2026-07-15",
        "endDate": "2026-08-15",
        "startTime": "10:00",
        "endTime": "14:00",
        "repeat": "Daily",
        "priority": "Normal",
        "status": "Active"
    }
    res2 = client.post("/schedules", json=payload2)
    assert res2.status_code == 400
    assert "Schedule conflict" in res2.json()["detail"]

    # Overlapping schedule with HIGHER priority (should succeed)
    payload3 = {
        "name": "High Priority Override",
        "playlistId": playlist_id,
        "deviceIds": [device_id],
        "startDate": "2026-07-15",
        "endDate": "2026-08-15",
        "startTime": "10:00",
        "endTime": "14:00",
        "repeat": "Daily",
        "priority": "Emergency",
        "status": "Active"
    }
    res3 = client.post("/schedules", json=payload3)
    assert res3.status_code == 201

def test_schedule_invalid_dates(client):
    # First create a device and media to assign
    device_res = client.post("/devices", json={
        "name": "Test Device",
        "location": "Lobby",
        "resolution": "1920x1080",
        "status": "Online",
        "lastSeen": "now",
        "lastSeenMs": 123
    })
    device_id = device_res.json()["id"]

    file_content = b"fake image"
    media_res = client.post("/media/upload", files={"file": ("test.jpg", file_content, "image/jpeg")})
    media_id = media_res.json()["id"]

    # Create Playlist
    playlist_res = client.post("/playlists", json={
        "name": "My Playlist",
        "description": "Test description",
        "status": "Draft",
        "totalDuration": 10,
        "updatedAt": 12345,
        "items": [
            {
                "id": "item-1",
                "mediaId": media_id,
                "duration": 10
            }
        ],
        "assignedDeviceIds": [device_id]
    })
    playlist_id = playlist_res.json()["id"]

    payload = {
        "name": "Invalid",
        "playlistId": playlist_id,
        "deviceIds": [],
        "startDate": "2026-08-01",
        "endDate": "2026-07-01",
        "startTime": "08:00",
        "endTime": "12:00",
        "repeat": "Daily",
        "priority": "Normal",
        "status": "Active"
    }
    res = client.post("/schedules", json=payload)
    assert res.status_code == 400
    assert "Start date cannot be after end date" in res.json()["detail"]

def test_get_schedules(client):
    res = client.get("/schedules")
    assert res.status_code == 200
    assert type(res.json()) == list

def test_delete_schedule(client):
    device_res = client.post("/devices", json={
        "name": "Sch Device 3",
        "location": "Lobby",
        "resolution": "1920x1080",
        "status": "Online",
        "lastSeen": "now",
        "lastSeenMs": 123
    })
    device_id = device_res.json()["id"]

    file_content = b"fake image"
    media_res = client.post("/media/upload", files={"file": ("test3.jpg", file_content, "image/jpeg")})
    media_id = media_res.json()["id"]

    playlist_res = client.post("/playlists", json={
        "name": "Sch Playlist 3",
        "description": "Test",
        "status": "Draft",
        "totalDuration": 10,
        "updatedAt": 12345,
        "items": [
            {
                "id": "item-1",
                "mediaId": media_id,
                "duration": 10
            }
        ],
        "assignedDeviceIds": []
    })
    playlist_id = playlist_res.json()["id"]

    payload = {
        "name": "To Delete",
        "playlistId": playlist_id,
        "deviceIds": [device_id],
        "startDate": "2026-07-01",
        "endDate": "2026-07-31",
        "startTime": "08:00",
        "endTime": "12:00",
        "repeat": "Daily",
        "priority": "Normal",
        "status": "Active"
    }
    res = client.post("/schedules", json=payload)
    schedule_id = res.json()["id"]

    del_res = client.delete(f"/schedules/{schedule_id}")
    assert del_res.status_code == 204

    get_res = client.get(f"/schedules/{schedule_id}")
    assert get_res.status_code == 404
