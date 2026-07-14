from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from uuid import UUID

class AppUpdateBase(BaseModel):
    version_name: str
    version_code: int
    apk_filename: str
    apk_url: str
    checksum_sha256: str
    file_size: int
    release_notes: Optional[str] = None
    mandatory: bool = False
    is_active: bool = False

class AppUpdateCreate(AppUpdateBase):
    pass

class AppUpdateResponse(AppUpdateBase):
    id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AppUpdateCheckResponse(BaseModel):
    update_available: bool
    version_name: Optional[str] = None
    version_code: Optional[int] = None
    apk_url: Optional[str] = None
    checksum_sha256: Optional[str] = None
    file_size: Optional[int] = None
    mandatory: Optional[bool] = None
    release_notes: Optional[str] = None
