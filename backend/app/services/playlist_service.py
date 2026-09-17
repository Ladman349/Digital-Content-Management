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
from app.core.tenancy import apply_owner_change, ensure_referable, owner_for_new, scope_query, visible

class PlaylistService:

    @staticmethod
    def _validate_playlist_data(db: Session, items, assignedDeviceIds, principal=None, check_item_owner=True, check_device_owner=True):
        if not items:
            raise HTTPException(status_code=400, detail="At least one PlaylistItem is required.")
            
        media_ids_seen = set()
        for item in items:
            if item.duration <= 0:
                raise HTTPException(status_code=400, detail="Duration must be greater than zero.")
            if item.mediaId in media_ids_seen:
                raise HTTPException(status_code=400, detail="Duplicate media within the same playlist is not allowed.")
            media_ids_seen.add(item.mediaId)
            
            # Validate media exists, and that a client user is only using their own files. Rows
            # already on the playlist are not re-checked for ownership, so an administrator's
            # earlier choices never make the playlist uneditable for its client.
            media = db.query(Media).filter(Media.id == item.mediaId).first()
            ensure_referable(media, principal if check_item_owner else None, f"Referenced Media ID {item.mediaId} does not exist.")

        for device_id in assignedDeviceIds:
            device = db.query(Device).filter(Device.id == device_id).first()
            ensure_referable(device, principal if check_device_owner else None, f"Referenced Device ID {device_id} does not exist.")

    @staticmethod
    def _claim_devices(db: Session, playlist_id: str, device_ids) -> None:
        """
        A screen has one directly-assigned playlist. The player takes whichever row it finds first,
        so assigning here removes the screen from every other playlist. Done server-side because a
        client user cannot see, and so cannot tidy up, an assignment made by someone else.
        """
        if not device_ids:
            return
        db.query(DevicePlaylist).filter(
            DevicePlaylist.deviceId.in_(list(device_ids)),
            DevicePlaylist.playlistId != playlist_id,
        ).delete(synchronize_session=False)

    @staticmethod
    def get_playlists(db: Session, principal=None) -> List[Playlist]:
        return scope_query(db.query(Playlist), Playlist, principal).all()

    @staticmethod
    def get_playlist(db: Session, playlist_id: str, principal=None) -> Playlist:
        return visible(db.query(Playlist).filter(Playlist.id == playlist_id).first(), principal)

    @staticmethod
    def create_playlist(db: Session, payload: PlaylistCreate, principal=None) -> Playlist:
        if not payload.name:
            raise HTTPException(status_code=400, detail="Playlist name is required.")
            
        PlaylistService._validate_playlist_data(db, payload.items, payload.assignedDeviceIds, principal)

        new_id = f"PL-NEW-{int(time.time() * 1000)}"
        
        playlist = Playlist(
            id=new_id,
            name=payload.name,
            description=payload.description,
            status=payload.status,
            totalDuration=payload.totalDuration,
            createdAt=int(time.time() * 1000),
            updatedAt=int(time.time() * 1000),
            clientId=owner_for_new(principal),
        )
        db.add(playlist)
        db.commit()

        PlaylistService._claim_devices(db, new_id, payload.assignedDeviceIds)

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
        from app.core.cache import PlayerCache
        PlayerCache.invalidate_all()
        return playlist

    @staticmethod
    def update_playlist(db: Session, playlist_id: str, payload: PlaylistUpdate, principal=None) -> Playlist:
        playlist = visible(db.query(Playlist).filter(Playlist.id == playlist_id).first(), principal)
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
            PlaylistService._validate_playlist_data(
                db,
                items_to_check,
                devices_to_check,
                principal,
                check_item_owner=payload.items is not None,
                check_device_owner=payload.assignedDeviceIds is not None,
            )

        update_data = payload.model_dump(exclude_unset=True, exclude={"items", "assignedDeviceIds"})
        apply_owner_change(playlist, update_data, principal, db)
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
            PlaylistService._claim_devices(db, playlist_id, payload.assignedDeviceIds)
            db.query(DevicePlaylist).filter(DevicePlaylist.playlistId == playlist_id).delete()
            for device_id in payload.assignedDeviceIds:
                dp = DevicePlaylist(
                    playlistId=playlist_id,
                    deviceId=device_id
                )
                db.add(dp)

        db.commit()
        db.refresh(playlist)
        from app.core.cache import PlayerCache
        PlayerCache.invalidate_all()
        return playlist

    @staticmethod
    def delete_playlist(db: Session, playlist_id: str, principal=None) -> bool:
        from fastapi import HTTPException
        from sqlalchemy.exc import IntegrityError
        
        playlist = visible(db.query(Playlist).filter(Playlist.id == playlist_id).first(), principal)
        if not playlist:
            return False

        # Guard explicitly: production FKs cascade, so IntegrityError never fires.
        from app.models.schedule import Schedule
        schedule_count = db.query(Schedule).filter(Schedule.playlistId == playlist_id).count()
        if schedule_count > 0:
            raise HTTPException(
                status_code=409,
                detail=f"Cannot delete playlist because it is referenced by {schedule_count} schedule(s). Delete or reassign those schedules first."
            )

        try:
            db.delete(playlist)
            db.commit()
            from app.core.cache import PlayerCache
            PlayerCache.invalidate_all()
            return True
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=409,
                detail="Cannot delete playlist because it is assigned to one or more schedules."
            )
