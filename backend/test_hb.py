import requests
import json

payload = {
    "installationId": "test-id",
    "currentPlaylistId": None,
    "currentMediaId": None,
    "currentPositionMs": 0,
    "playbackState": "IDLE",
    "appVersionName": "1.0",
    "appVersionCode": 1,
    "androidVersion": "11",
    "uptimeSeconds": 100,
    "manufacturer": "Test",
    "model": "Test",
    "availableStorageBytes": 1000,
    "totalStorageBytes": 2000,
    "availableMemoryBytes": 500,
    "totalMemoryBytes": 1000,
    "networkType": "WIFI"
}

try:
    response = requests.post("http://localhost:8000/devices/heartbeat", json=payload)
    print(f"HTTP Status: {response.status_code}")
    print(f"Response Body: {response.text}")
except Exception as e:
    print(f"Error: {e}")
