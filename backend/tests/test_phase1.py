import pytest
from fastapi.testclient import TestClient
from main import app
from app.database.database import engine, get_db
from sqlalchemy.orm import sessionmaker

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

def test_device_register():
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
    
def test_current_playlist_empty():
    # Fetch current playlist for a random device
    response = client.get("/devices/TV-RANDOM/current-playlist")
    assert response.status_code == 204 # No Content
