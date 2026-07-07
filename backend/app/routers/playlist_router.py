from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.playlist import PlaylistCreate, PlaylistUpdate, PlaylistResponse
from app.services.playlist_service import PlaylistService

router = APIRouter(
    prefix="/playlists",
    tags=["Playlists"]
)

@router.get("", response_model=List[PlaylistResponse])
def get_playlists(db: Session = Depends(get_db)):
    return PlaylistService.get_playlists(db)

@router.get("/{playlist_id}", response_model=PlaylistResponse)
def get_playlist(playlist_id: str, db: Session = Depends(get_db)):
    playlist = PlaylistService.get_playlist(db, playlist_id)
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return playlist

@router.post("", response_model=PlaylistResponse, status_code=status.HTTP_201_CREATED)
def create_playlist(payload: PlaylistCreate, db: Session = Depends(get_db)):
    return PlaylistService.create_playlist(db, payload)

@router.put("/{playlist_id}", response_model=PlaylistResponse)
def update_playlist(playlist_id: str, payload: PlaylistUpdate, db: Session = Depends(get_db)):
    playlist = PlaylistService.update_playlist(db, playlist_id, payload)
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return playlist

@router.delete("/{playlist_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_playlist(playlist_id: str, db: Session = Depends(get_db)):
    success = PlaylistService.delete_playlist(db, playlist_id)
    if not success:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return None