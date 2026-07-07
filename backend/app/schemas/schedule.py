from pydantic import BaseModel
from typing import List, Optional
from datetime import date, time

class ScheduleBase(BaseModel):
    name: str
    playlistId: str
    startDate: date
    endDate: date
    startTime: time
    endTime: time
    repeat: str
    priority: str
    status: str

class ScheduleCreate(ScheduleBase):
    deviceIds: List[str]

class ScheduleUpdate(BaseModel):
    name: Optional[str] = None
    playlistId: Optional[str] = None
    startDate: Optional[date] = None
    endDate: Optional[date] = None
    startTime: Optional[time] = None
    endTime: Optional[time] = None
    repeat: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    deviceIds: Optional[List[str]] = None

class ScheduleResponse(ScheduleBase):
    id: str
    deviceIds: List[str] = []
    createdAt: int
    updatedAt: int

    class Config:
        from_attributes = True
