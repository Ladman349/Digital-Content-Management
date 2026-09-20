from pydantic import BaseModel, ConfigDict, Field
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
    orientation: Optional[str] = "LANDSCAPE"
    # Owning client; None is operator-owned. Only an administrator can change it.
    clientId: Optional[str] = None

class DeviceCreate(DeviceBase):
    id: str

class DeviceUpdate(BaseModel):
    """
    Operator-editable device fields.

    Liveness fields (status, lastSeen, lastSeenMs, heartbeatAt, ipAddress, storage, appVersion,
    uptimeSeconds, firmwareVersion) are deliberately excluded: they are owned by the player's
    heartbeat, and `status` is recomputed from heartbeat freshness on every read, so accepting a
    client-supplied value would silently be discarded on the next request.
    """
    name: Optional[str] = None
    location: Optional[str] = None
    resolution: Optional[str] = None
    orientation: Optional[str] = None
    # Administrators only: hands the screen to a client, or back to the operator with null.
    clientId: Optional[str] = None

class DeviceResponse(DeviceBase):
    id: str
    # Health. Null until the screen runs a player that reports it.
    lastError: Optional[str] = None
    lastErrorAt: Optional[int] = None
    pendingPlays: Optional[int] = None
    screenshotRequestedAt: Optional[int] = None
    screenshotAt: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class HeartbeatResponse(DeviceResponse):
    # True while the CMS is waiting for a screenshot from this screen.
    screenshotRequested: bool = False

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
    # The most recent error the player logged, and when (device clock, epoch ms).
    lastError: Optional[str] = Field(default=None, max_length=2000)
    lastErrorAt: Optional[int] = None
    pendingPlays: Optional[int] = Field(default=None, ge=0)

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