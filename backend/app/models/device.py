from enum import Enum
from sqlalchemy import Column, String, BigInteger, Integer, Float, ForeignKey, Text
from app.database.base import Base

class DeviceOrientation(str, Enum):
    LANDSCAPE = "LANDSCAPE"
    PORTRAIT_RIGHT = "PORTRAIT_RIGHT"
    PORTRAIT_LEFT = "PORTRAIT_LEFT"
    UPSIDE_DOWN = "UPSIDE_DOWN"

class Device(Base):
    __tablename__ = "devices"

    # We will use a string ID (e.g., "TV-NEW-123") since the frontend generates strings
    # Or we can let the backend generate UUID strings. 
    # For compatibility, we make 'id' a String and Primary Key.
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    location = Column(String, nullable=False)
    resolution = Column(String, nullable=False)
    status = Column(String, nullable=False, default="Offline")
    lastSeen = Column(String, nullable=False)
    lastSeenMs = Column(BigInteger, nullable=False)
    ipAddress = Column(String, nullable=True)
    storage = Column(String, nullable=True)

    # Heartbeat and Android TV specific fields
    heartbeatAt = Column(BigInteger, nullable=True)
    appVersion = Column(String, nullable=True)
    currentPlaylistId = Column(String, nullable=True)
    currentMediaId = Column(String, nullable=True)
    storageUsed = Column(Float, nullable=True)
    storageTotal = Column(Float, nullable=True)
    uptimeSeconds = Column(BigInteger, nullable=True)
    firmwareVersion = Column(String, nullable=True)
    deviceToken = Column(String, nullable=True)
    androidId = Column(String, nullable=True)

    orientation = Column(String, nullable=False, default=DeviceOrientation.LANDSCAPE.value)

    # Health, reported with the heartbeat by player 1.4.0 and later. See app/database/health_schema.py.
    lastError = Column(Text, nullable=True)
    lastErrorAt = Column(BigInteger, nullable=True)
    # Plays recorded on the screen and not yet delivered for the reports.
    pendingPlays = Column(Integer, nullable=True)
    # A screenshot is asked for here and the player answers on its next heartbeat.
    screenshotRequestedAt = Column(BigInteger, nullable=True)
    screenshotAt = Column(BigInteger, nullable=True)

    # Owning client. NULL means the screen belongs to the operator: a player registers itself
    # unowned, and an administrator hands it to a client from the Screens page.
    clientId = Column(String, ForeignKey("clients.id"), nullable=True, index=True)
