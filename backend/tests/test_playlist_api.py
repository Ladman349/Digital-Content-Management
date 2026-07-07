import pytest

def test_create_playlist(client):
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
    payload = {
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
    }

    res = client.post("/playlists", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "My Playlist"
    assert len(data["items"]) == 1
    assert data["items"][0]["mediaId"] == media_id
    assert len(data["assignedDeviceIds"]) == 1
    assert data["assignedDeviceIds"][0] == device_id

def test_create_playlist_validation(client):
    # Missing items
    payload = {
        "name": "Empty Playlist",
        "description": "",
        "status": "Draft",
        "totalDuration": 0,
        "updatedAt": 12345,
        "items": [],
        "assignedDeviceIds": []
    }
    res = client.post("/playlists", json=payload)
    assert res.status_code == 400
    assert "At least one PlaylistItem" in res.json()["detail"]

    # Negative duration
    file_content = b"fake image"
    media_res = client.post("/media/upload", files={"file": ("test2.jpg", file_content, "image/jpeg")})
    media_id = media_res.json()["id"]

    payload["items"] = [{"id": "item-1", "mediaId": media_id, "duration": -5}]
    res = client.post("/playlists", json=payload)
    assert res.status_code == 400
    assert "greater than zero" in res.json()["detail"]

    # Duplicate media
    payload["items"] = [
        {"id": "item-1", "mediaId": media_id, "duration": 10},
        {"id": "item-2", "mediaId": media_id, "duration": 10}
    ]
    res = client.post("/playlists", json=payload)
    assert res.status_code == 400
    assert "Duplicate media" in res.json()["detail"]

def test_get_playlists(client):
    res = client.get("/playlists")
    assert res.status_code == 200
    assert type(res.json()) == list

def test_delete_playlist(client):
    file_content = b"fake image"
    media_res = client.post("/media/upload", files={"file": ("test3.jpg", file_content, "image/jpeg")})
    media_id = media_res.json()["id"]

    payload = {
        "name": "To Delete",
        "description": "",
        "status": "Draft",
        "totalDuration": 10,
        "updatedAt": 12345,
        "items": [{"id": "item-delete", "mediaId": media_id, "duration": 10}],
        "assignedDeviceIds": []
    }
    create_res = client.post("/playlists", json=payload)
    playlist_id = create_res.json()["id"]

    del_res = client.delete(f"/playlists/{playlist_id}")
    assert del_res.status_code == 204

    get_res = client.get(f"/playlists/{playlist_id}")
    assert get_res.status_code == 404
