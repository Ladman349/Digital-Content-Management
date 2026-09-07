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
    # Nullable in the database, so coerce NULL to False rather than failing serialisation.
    mandatory: Optional[bool] = False
    is_active: Optional[bool] = False

class AppUpdateResponse(AppUpdateBase):
    id: UUID
    download_count: int
    last_downloaded_at: Optional[datetime] = None
    created_at: datetime
    # NULL means the APK exists only on this server's disk and will disappear on the next
    # redeploy. The CMS surfaces that as a warning.
    storage_uri: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class AppUpdateCheckResponse(BaseModel):
    updateAvailable: bool
    currentVersionCode: int
    latestVersionCode: Optional[int] = None
    versionName: Optional[str] = None
    apkUrl: Optional[str] = None
    checksum: Optional[str] = None
    fileSize: Optional[int] = None
    mandatory: Optional[bool] = None
    releaseNotes: Optional[str] = None
