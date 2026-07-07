from sqlalchemy import Column, String, BigInteger, Integer
from sqlalchemy.orm import relationship
from app.database.base import Base
import time

class Playlist(Base):
    __tablename__ = "playlists"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True, default="")
    status = Column(String, nullable=False, default="Draft")
    totalDuration = Column(Integer, nullable=False, default=0)
    createdAt = Column(BigInteger, default=lambda: int(time.time() * 1000))
    updatedAt = Column(BigInteger, default=lambda: int(time.time() * 1000))

    items = relationship("PlaylistItem", back_populates="playlist", cascade="all, delete-orphan", order_by="PlaylistItem.order")
    devices = relationship("DevicePlaylist", back_populates="playlist", cascade="all, delete-orphan")

    @property
    def assignedDeviceIds(self):
        return [d.deviceId for d in self.devices]