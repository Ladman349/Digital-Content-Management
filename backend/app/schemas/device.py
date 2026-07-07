from pydantic import BaseModel, ConfigDict
from typing import Optional

class DeviceBase(BaseModel):
    name: str
    location: str
    resolution: str
    status: str
    lastSeen: str
    lastSeenMs: int
    ipAddress: Optional[str] = None
    storage: Optional[str] = None
    
    # New Heartbeat fields
    heartbeatAt: Optional[int] = None
    appVersion: Optional[str] = None
    currentPlaylistId: Optional[str] = None
    currentMediaId: Optional[str] = None
    storageUsed: Optional[float] = None
    storageTotal: Optional[float] = None
    uptimeSeconds: Optional[int] = None
    firmwareVersion: Optional[str] = None

class DeviceCreate(DeviceBase):
    id: str

class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    resolution: Optional[str] = None
    status: Optional[str] = None
    lastSeen: Optional[str] = None
    lastSeenMs: Optional[int] = None
    ipAddress: Optional[str] = None
    storage: Optional[str] = None

class DeviceResponse(DeviceBase):
    id: str

    model_config = ConfigDict(from_attributes=True)

class HeartbeatRequest(BaseModel):
    deviceId: str
    storageUsed: Optional[float] = None
    storageTotal: Optional[float] = None
    currentPlaylistId: Optional[str] = None
    currentMediaId: Optional[str] = None
    appVersion: Optional[str] = None
    uptimeSeconds: Optional[int] = None
    ipAddress: Optional[str] = None
    firmwareVersion: Optional[str] = None

class DeviceStatusResponse(BaseModel):
    status: str
    lastSeen: str
    heartbeatAt: Optional[int] = None
    storage: Optional[str] = None
    currentPlaylistId: Optional[str] = None
    currentMediaId: Optional[str] = None

class DeviceRegisterRequest(BaseModel):
    name: str
    resolution: str
    ipAddress: Optional[str] = None
    appVersion: Optional[str] = None
    androidId: Optional[str] = None

class DeviceRegisterResponse(BaseModel):
    deviceId: str
    deviceToken: str
    heartbeatInterval: int = 60
    syncInterval: int = 60
    backendTime: str