from sqlalchemy.orm import Session

from app.models.device_playlist import DevicePlaylist
from app.models.playlist_item import PlaylistItem
from app.models.media import Media


class DevicePlaylistService:

    @staticmethod
    def assign_playlist(
        device_id: str,
        playlist_id: int,
        db: Session
    ):

        existing = (
            db.query(DevicePlaylist)
            .filter(DevicePlaylist.device_id == device_id)
            .first()
        )

        if existing:

            existing.playlist_id = playlist_id

            db.commit()
            db.refresh(existing)

            return existing

        assignment = DevicePlaylist(
            device_id=device_id,
            playlist_id=playlist_id
        )

        db.add(assignment)
        db.commit()
        db.refresh(assignment)

        return assignment


    @staticmethod
    def get_device_playlist(
        device_id: str,
        db: Session
    ):

        assignment = (
            db.query(DevicePlaylist)
            .filter(
                DevicePlaylist.device_id == device_id
            )
            .first()
        )

        if assignment is None:
            return []

        playlist_items = (
            db.query(
                PlaylistItem,
                Media
            )
            .join(
                Media,
                PlaylistItem.media_id == Media.id
            )
            .filter(
                PlaylistItem.playlist_id == assignment.playlist_id
            )
            .order_by(
                PlaylistItem.sequence
            )
            .all()
        )

        result = []

        for item, media in playlist_items:

            result.append({

                "media_id": media.id,

                "filename": media.filename,

                "media_type": media.media_type,

                "url": f"/media/{media.filename}",

                "sequence": item.sequence

            })

        return result