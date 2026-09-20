from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.playlist import PlaylistCreate, PlaylistUpdate, PlaylistResponse
from app.core.auth import Principal, get_principal
from app.services.playlist_service import PlaylistService
from app.services.audit_service import AuditService, describe_changes

router = APIRouter(
    prefix="/playlists",
    tags=["Playlists"],
    dependencies=[Depends(get_principal)]
)

@router.get("", response_model=List[PlaylistResponse])
def get_playlists(db: Session = Depends(get_db), principal: Principal = Depends(get_principal)):
    return PlaylistService.to_responses(db, PlaylistService.get_playlists(db, principal), principal)

@router.get("/{playlist_id}", response_model=PlaylistResponse)
def get_playlist(playlist_id: str, db: Session = Depends(get_db), principal: Principal = Depends(get_principal)):
    playlist = PlaylistService.get_playlist(db, playlist_id, principal)
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return PlaylistService.to_response(db, playlist, principal)

@router.post("", response_model=PlaylistResponse, status_code=status.HTTP_201_CREATED)
def create_playlist(payload: PlaylistCreate, db: Session = Depends(get_db), principal: Principal = Depends(get_principal)):
    playlist = PlaylistService.create_playlist(db, payload, principal)
    AuditService.record(db, principal, "created", "playlist", playlist.id, playlist.name, playlist.clientId, f"{len(payload.items)} item(s), {len(payload.assignedDeviceIds)} screen(s)")
    return PlaylistService.to_response(db, playlist, principal)

@router.put("/{playlist_id}", response_model=PlaylistResponse)
def update_playlist(playlist_id: str, payload: PlaylistUpdate, db: Session = Depends(get_db), principal: Principal = Depends(get_principal)):
    playlist = PlaylistService.update_playlist(db, playlist_id, payload, principal)
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    AuditService.record(db, principal, "updated", "playlist", playlist.id, playlist.name, playlist.clientId, describe_changes(payload.model_dump(exclude_unset=True)))
    return PlaylistService.to_response(db, playlist, principal)

@router.delete("/{playlist_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_playlist(playlist_id: str, db: Session = Depends(get_db), principal: Principal = Depends(get_principal)):
    doomed = PlaylistService.get_playlist(db, playlist_id, principal)
    label = (doomed.name, doomed.clientId) if doomed else (None, None)
    success = PlaylistService.delete_playlist(db, playlist_id, principal)
    if not success:
        raise HTTPException(status_code=404, detail="Playlist not found")
    AuditService.record(db, principal, "deleted", "playlist", playlist_id, label[0], label[1])
    return None
