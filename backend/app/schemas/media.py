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
    clientId: Optional[str] = None

class MediaCreate(MediaBase):
    pass

class MediaUpdate(BaseModel):
    # Only user-editable metadata. Storage URIs, type, size and upload
    # provenance are owned by the server and must never be client-settable
    # (the download proxy fetches whatever URI is stored).
    name: Optional[str] = None
    category: Optional[str] = None
    dimensions: Optional[str] = None
    duration: Optional[int] = None
    # Administrators only: moves the file to another client, or back to the operator with null.
    clientId: Optional[str] = None

class MediaResponse(MediaBase):
    id: str

    class Config:
        from_attributes = True
