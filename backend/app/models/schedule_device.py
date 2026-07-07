from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.orm import relationship
from app.database.base import Base

class ScheduleDevice(Base):
    __tablename__ = "schedule_devices"

    scheduleId = Column(String, ForeignKey("schedules.id"), primary_key=True)
    deviceId = Column(String, ForeignKey("devices.id"), primary_key=True)

    schedule = relationship("Schedule", back_populates="devices")
