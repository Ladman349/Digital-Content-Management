import os
import pytest
import time

def test_upload_image(client):
    file_content = b"fake image content"
    files = {"file": ("test_image.jpg", file_content, "image/jpeg")}
    
    response = client.post("/media/upload", files=files)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "test_image.jpg"
    assert data["type"] == "Image"
    assert "id" in data
    assert data["id"].startswith("MEDIA-")
    assert data["size"] == len(file_content)
    
def test_upload_video(client):
    file_content = b"fake video content"
    files = {"file": ("test_video.mp4", file_content, "video/mp4")}
    
    response = client.post("/media/upload", files=files)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "test_video.mp4"
    assert data["type"] == "Video"
    assert data["duration"] == 120
    assert data["dimensions"] == "1920x1080"
    
def test_upload_unsupported(client):
    file_content = b"fake exe content"
    files = {"file": ("virus.exe", file_content, "application/x-msdownload")}
    
    response = client.post("/media/upload", files=files)
    assert response.status_code == 400

def test_upload_empty(client):
    files = {"file": ("empty.jpg", b"", "image/jpeg")}
    
    response = client.post("/media/upload", files=files)
    assert response.status_code == 400

def test_get_all_media(client):
    response = client.get("/media")
    assert response.status_code == 200
    assert type(response.json()) == list

def test_delete_media(client):
    file_content = b"fake image"
    files = {"file": ("to_delete.jpg", file_content, "image/jpeg")}
    
    response = client.post("/media/upload", files=files)
    media_id = response.json()["id"]
    
    del_response = client.delete(f"/media/{media_id}")
    assert del_response.status_code == 204
    
    get_response = client.get(f"/media/{media_id}")
    assert get_response.status_code == 404
