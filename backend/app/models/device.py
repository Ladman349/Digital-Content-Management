from sqlalchemy import Column, String, BigInteger, Integer, Float
from app.database.base import Base

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