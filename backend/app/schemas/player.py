from pydantic import BaseModel
from typing import List, Optional


class PlaylistMediaItemResponse(BaseModel):
    """Media metadata included in each playlist item for the Android player."""
    mediaId: str
    name: str
    type: str
    size: int
    duration: Optional[int] = None
    downloadUrl: str
    checksum: Optional[str] = None


class PlaylistItemWithMediaResponse(BaseModel):
    """A single playlist item with its associated media metadata."""
    id: str
    mediaId: str
    order: int
    duration: int
    media: PlaylistMediaItemResponse


class CurrentPlaylistResponse(BaseModel):
    """
    Response for GET /devices/{id}/current-playlist.

    playlistVersion is the playlist's updatedAt timestamp,
    used by the Android player to detect changes without downloading full content.
    """
    playlistId: str
    playlistName: str
    playlistVersion: int
    updatedAt: int
    items: List[PlaylistItemWithMediaResponse]
