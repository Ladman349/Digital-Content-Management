import uuid
import time
from typing import List
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.playlist import Playlist
from app.models.playlist_item import PlaylistItem
from app.models.device_playlist import DevicePlaylist
from app.models.media import Media
from app.models.device import Device
from app.schemas.playlist import PlaylistCreate, PlaylistUpdate

class PlaylistService:

    @staticmethod
    def _validate_playlist_data(db: Session, items, assignedDeviceIds):
        if not items:
            raise HTTPException(status_code=400, detail="At least one PlaylistItem is required.")
            
        media_ids_seen = set()
        for item in items:
            if item.duration <= 0:
                raise HTTPException(status_code=400, detail="Duration must be greater than zero.")
            if item.mediaId in media_ids_seen:
                raise HTTPException(status_code=400, detail="Duplicate media within the same playlist is not allowed.")
            media_ids_seen.add(item.mediaId)
            
            # Validate media exists
            if not db.query(Media).filter(Media.id == item.mediaId).first():
                raise HTTPException(status_code=400, detail=f"Referenced Media ID {item.mediaId} does not exist.")

        for device_id in assignedDeviceIds:
            if not db.query(Device).filter(Device.id == device_id).first():
                raise HTTPException(status_code=400, detail=f"Referenced Device ID {device_id} does not exist.")

    @staticmethod
    def get_playlists(db: Session) -> List[Playlist]:
        return db.query(Playlist).all()

    @staticmethod
    def get_playlist(db: Session, playlist_id: str) -> Playlist:
        return db.query(Playlist).filter(Playlist.id == playlist_id).first()

    @staticmethod
    def create_playlist(db: Session, payload: PlaylistCreate) -> Playlist:
        if not payload.name:
            raise HTTPException(status_code=400, detail="Playlist name is required.")
            
        PlaylistService._validate_playlist_data(db, payload.items, payload.assignedDeviceIds)

        new_id = f"PL-NEW-{int(time.time() * 1000)}"
        
        playlist = Playlist(
            id=new_id,
            name=payload.name,
            description=payload.description,
            status=payload.status,
            totalDuration=payload.totalDuration,
            createdAt=int(time.time() * 1000),
            updatedAt=int(time.time() * 1000)
        )
        db.add(playlist)
        db.commit()

        for idx, item in enumerate(payload.items):
            pl_item = PlaylistItem(
                id=item.id,
                playlistId=new_id,
                mediaId=item.mediaId,
                order=idx + 1,
                duration=item.duration,
                transition="none"
            )
            db.add(pl_item)

        for device_id in payload.assignedDeviceIds:
            dp = DevicePlaylist(
                playlistId=new_id,
                deviceId=device_id
            )
            db.add(dp)

        db.commit()
        db.refresh(playlist)
        return playlist

    @staticmethod
    def update_playlist(db: Session, playlist_id: str, payload: PlaylistUpdate) -> Playlist:
        playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
        if not playlist:
            return None

        if payload.name == "":
            raise HTTPException(status_code=400, detail="Playlist name cannot be empty.")

        # Block changing status away from Published if active schedules reference this playlist
        if payload.status is not None and playlist.status == "Published" and payload.status != "Published":
            from app.models.schedule import Schedule
            active_schedules = db.query(Schedule).filter(
                Schedule.playlistId == playlist_id,
                Schedule.status == "Active"
            ).first()
            if active_schedules:
                raise HTTPException(
                    status_code=409,
                    detail="Cannot change playlist status because it is currently assigned to one or more active schedules."
                )
            
        if payload.items is not None or payload.assignedDeviceIds is not None:
            items_to_check = payload.items if payload.items is not None else [i for i in playlist.items]
            devices_to_check = payload.assignedDeviceIds if payload.assignedDeviceIds is not None else [d.deviceId for d in playlist.devices]
            PlaylistService._validate_playlist_data(db, items_to_check, devices_to_check)

        update_data = payload.model_dump(exclude_unset=True, exclude={"items", "assignedDeviceIds"})
        for key, value in update_data.items():
            setattr(playlist, key, value)
            
        playlist.updatedAt = int(time.time() * 1000)

        if payload.items is not None:
            db.query(PlaylistItem).filter(PlaylistItem.playlistId == playlist_id).delete()
            for idx, item in enumerate(payload.items):
                pl_item = PlaylistItem(
                    id=item.id,
                    playlistId=playlist_id,
                    mediaId=item.mediaId,
                    order=idx + 1,
                    duration=item.duration,
                    transition="none"
                )
                db.add(pl_item)

        if payload.assignedDeviceIds is not None:
            db.query(DevicePlaylist).filter(DevicePlaylist.playlistId == playlist_id).delete()
            for device_id in payload.assignedDeviceIds:
                dp = DevicePlaylist(
                    playlistId=playlist_id,
                    deviceId=device_id
                )
                db.add(dp)

        db.commit()
        db.refresh(playlist)
        return playlist

    @staticmethod
    def delete_playlist(db: Session, playlist_id: str) -> bool:
        from fastapi import HTTPException
        from sqlalchemy.exc import IntegrityError
        
        playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
        if not playlist:
            return False
            
        try:
            db.delete(playlist)
            db.commit()
            return True
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=409,
                detail="Cannot delete playlist because it is assigned to one or more schedules."
            )
