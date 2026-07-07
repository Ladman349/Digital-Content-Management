from pydantic import BaseModel
from typing import Optional

class MediaBase(BaseModel):
    name: str
    type: str
    category: str
    thumbnail: str
    originalFile: str
    size: int
    dimensions: str
    duration: Optional[int] = None
    uploadedAt: int
    uploadedBy: str
    checksum: Optional[str] = None

class MediaCreate(MediaBase):
    pass

class MediaUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    category: Optional[str] = None
    thumbnail: Optional[str] = None
    originalFile: Optional[str] = None
    size: Optional[int] = None
    dimensions: Optional[str] = None
    duration: Optional[int] = None
    uploadedAt: Optional[int] = None
    uploadedBy: Optional[str] = None

class MediaResponse(MediaBase):
    id: str

    class Config:
        from_attributes = True
