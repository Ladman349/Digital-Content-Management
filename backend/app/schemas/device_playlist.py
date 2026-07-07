from pydantic import BaseModel


class DevicePlaylistCreate(BaseModel):

    device_id: str
    playlist_id: int