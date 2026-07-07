from sqlalchemy import Column, String, BigInteger, ForeignKey, Date, Time
from sqlalchemy.orm import relationship
from app.database.base import Base
import time

class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    playlistId = Column(String, ForeignKey("playlists.id"), nullable=False)
    startDate = Column(Date, nullable=False)
    endDate = Column(Date, nullable=False)
    startTime = Column(Time, nullable=False)
    endTime = Column(Time, nullable=False)
    repeat = Column(String, nullable=False, default="Once")
    priority = Column(String, nullable=False, default="Normal")
    status = Column(String, nullable=False, default="Draft")
    createdAt = Column(BigInteger, default=lambda: int(time.time() * 1000))
    updatedAt = Column(BigInteger, default=lambda: int(time.time() * 1000))

    playlist = relationship("Playlist")
    devices = relationship("ScheduleDevice", back_populates="schedule", cascade="all, delete-orphan")

    @property
    def deviceIds(self):
        return [d.deviceId for d in self.devices]
