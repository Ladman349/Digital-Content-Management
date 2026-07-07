from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.orm import relationship
from app.database.base import Base

class DevicePlaylist(Base):
    __tablename__ = "device_playlists"

    playlistId = Column(String, ForeignKey("playlists.id", ondelete="CASCADE"), primary_key=True)
    deviceId = Column(String, ForeignKey("devices.id", ondelete="CASCADE"), primary_key=True)

    playlist = relationship("Playlist", back_populates="devices")