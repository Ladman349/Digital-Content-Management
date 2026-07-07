from pydantic import BaseModel, Field
from typing import List, Optional

class PlaylistItemBase(BaseModel):
    id: str
    mediaId: str
    duration: int

class PlaylistItemCreate(PlaylistItemBase):
    pass

class PlaylistItemResponse(PlaylistItemBase):
    class Config:
        from_attributes = True

class PlaylistBase(BaseModel):
    name: str
    description: str
    status: str
    totalDuration: int
    updatedAt: int

class PlaylistCreate(PlaylistBase):
    items: List[PlaylistItemCreate] = []
    assignedDeviceIds: List[str] = []

class PlaylistUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    totalDuration: Optional[int] = None
    updatedAt: Optional[int] = None
    items: Optional[List[PlaylistItemCreate]] = None
    assignedDeviceIds: Optional[List[str]] = None

class PlaylistResponse(PlaylistBase):
    id: str
    items: List[PlaylistItemResponse] = []
    assignedDeviceIds: List[str] = []

    class Config:
        from_attributes = True
