from fastapi import APIRouter
from fastapi import Depends

from sqlalchemy.orm import Session

from app.database.database import get_db

from app.schemas.device_playlist import DevicePlaylistCreate

from app.services.device_playlist_service import DevicePlaylistService

router = APIRouter(
    prefix="/device-playlists",
    tags=["Device Playlists"]
)


@router.post("/")
def assign_playlist(
    payload: DevicePlaylistCreate,
    db: Session = Depends(get_db)
):

    assignment = DevicePlaylistService.assign_playlist(
        payload.device_id,
        payload.playlist_id,
        db
    )

    return {
        "message": "Playlist assigned",
        "device_id": assignment.device_id,
        "playlist_id": assignment.playlist_id
    }
    
@router.get("/{device_id}/playlist")
def get_playlist(
    device_id: str,
    db: Session = Depends(get_db)
):

    return DevicePlaylistService.get_device_playlist(
        device_id,
        db
    )