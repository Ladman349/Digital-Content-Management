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
from app.schemas.playlist import PlaylistCreate, PlaylistUpdate, PlaylistResponse
from app.core.tenancy import apply_owner_change, ensure_referable, hidden_device_ids, owner_for_new, scope_query, visible

class PlaylistService:

    @staticmethod
    def _validate_items(db: Session, items, principal=None, tolerated_media_ids=frozenset()):
        if not items:
            raise HTTPException(status_code=400, detail="At least one PlaylistItem is required.")

        media_ids_seen = set()
        for item in items:
            if item.duration <= 0:
                raise HTTPException(status_code=400, detail="Duration must be greater than zero.")
            if item.mediaId in media_ids_seen:
                raise HTTPException(status_code=400, detail="Duplicate media within the same playlist is not allowed.")
            media_ids_seen.add(item.mediaId)

            # Validate media exists, and that a client user is only adding their own files. Media
            # already on the playlist is tolerated whoever owns it, so a file an administrator put
            # there never makes the playlist uneditable for its client.
            media = db.query(Media).filter(Media.id == item.mediaId).first()
            owner_check = None if item.mediaId in tolerated_media_ids else principal
            ensure_referable(media, owner_check, f"Referenced Media ID {item.mediaId} does not exist.")

    @staticmethod
    def _validate_devices(db: Session, device_ids, principal=None):
        for device_id in device_ids:
            device = db.query(Device).filter(Device.id == device_id).first()
            ensure_referable(device, principal, f"Referenced Device ID {device_id} does not exist.")

    @staticmethod
    def _item_ids(db: Session, playlist_id: str, items) -> List[str]:
        """
        Item ids come from the CMS and are the table's primary key. One that is blank, repeated, or
        already used by a different playlist is replaced, so a caller can neither collide with nor
        probe for rows in a playlist that is not theirs.
        """
        wanted = [item.id for item in items if item.id]
        taken = set()
        if wanted:
            rows = db.query(PlaylistItem.id).filter(PlaylistItem.id.in_(wanted), PlaylistItem.playlistId != playlist_id).all()
            taken = {row[0] for row in rows}

        ids = []
        for item in items:
            item_id = item.id
            if not item_id or item_id in taken:
                item_id = f"ITEM-{uuid.uuid4().hex[:12].upper()}"
            taken.add(item_id)
            ids.append(item_id)
        return ids

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
    def to_responses(db: Session, playlists, principal=None) -> List[PlaylistResponse]:
        """Serialises playlists, leaving out screens the caller may not see."""
        hidden = hidden_device_ids(db, {d.deviceId for p in playlists for d in p.devices}, principal)
        responses = []
        for playlist in playlists:
            response = PlaylistResponse.model_validate(playlist)
            if hidden:
                response.assignedDeviceIds = [d for d in response.assignedDeviceIds if d not in hidden]
            responses.append(response)
        return responses

    @staticmethod
    def to_response(db: Session, playlist: Playlist, principal=None) -> PlaylistResponse:
        return PlaylistService.to_responses(db, [playlist], principal)[0]

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

        PlaylistService._validate_items(db, payload.items, principal)
        PlaylistService._validate_devices(db, payload.assignedDeviceIds, principal)

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

        item_ids = PlaylistService._item_ids(db, new_id, payload.items)
        for idx, item in enumerate(payload.items):
            pl_item = PlaylistItem(
                id=item_ids[idx],
                playlistId=new_id,
                mediaId=item.mediaId,
                order=idx + 1,
                duration=item.duration,
                transition="none"
            )
            db.add(pl_item)

        for device_id in dict.fromkeys(payload.assignedDeviceIds):
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

        if payload.items is not None:
            PlaylistService._validate_items(db, payload.items, principal, tolerated_media_ids={i.mediaId for i in playlist.items})
        if payload.assignedDeviceIds is not None:
            PlaylistService._validate_devices(db, payload.assignedDeviceIds, principal)

        update_data = payload.model_dump(exclude_unset=True, exclude={"items", "assignedDeviceIds"})
        apply_owner_change(playlist, update_data, principal, db)
        for key, value in update_data.items():
            setattr(playlist, key, value)

        playlist.updatedAt = int(time.time() * 1000)

        if payload.items is not None:
            db.query(PlaylistItem).filter(PlaylistItem.playlistId == playlist_id).delete()
            item_ids = PlaylistService._item_ids(db, playlist_id, payload.items)
            for idx, item in enumerate(payload.items):
                pl_item = PlaylistItem(
                    id=item_ids[idx],
                    playlistId=playlist_id,
                    mediaId=item.mediaId,
                    order=idx + 1,
                    duration=item.duration,
                    transition="none"
                )
                db.add(pl_item)

        if payload.assignedDeviceIds is not None:
            # A client user's list only ever held the screens they can see, so it replaces only
            # those; screens an administrator assigned from outside their view stay assigned.
            keep = hidden_device_ids(db, [d.deviceId for d in playlist.devices], principal)
            PlaylistService._claim_devices(db, playlist_id, payload.assignedDeviceIds)
            stale = db.query(DevicePlaylist).filter(DevicePlaylist.playlistId == playlist_id)
            if keep:
                stale = stale.filter(DevicePlaylist.deviceId.notin_(keep))
            stale.delete(synchronize_session="fetch")
            for device_id in dict.fromkeys(payload.assignedDeviceIds):
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
