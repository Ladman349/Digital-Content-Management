from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

from app.models.device import Device
from app.models.schedule import Schedule
from app.models.schedule_device import ScheduleDevice
from app.models.playlist import Playlist
from app.models.playlist_item import PlaylistItem
from app.models.media import Media
from app.models.device_playlist import DevicePlaylist
from app.schemas.player import (
    CurrentPlaylistResponse,
    PlaylistItemWithMediaResponse,
    PlaylistMediaItemResponse,
)

PRIORITY_ORDER = {
    "Emergency": 4,
    "High": 3,
    "Normal": 2,
    "Low": 1,
}


def _matches_repeat(repeat: str, now: datetime, start_date_str: str) -> bool:
    """
    Check if the current datetime matches the schedule's repeat pattern.

    - Once / Daily: always matches within the date range
    - Weekdays: Monday through Friday
    - Weekends: Saturday and Sunday
    - Weekly: same weekday as the schedule's start date
    - Monthly: same day-of-month as the schedule's start date
    """
    weekday = now.weekday()  # 0=Monday, 6=Sunday

    if repeat in ("Once", "Daily"):
        return True
    elif repeat == "Weekdays":
        return weekday < 5
    elif repeat == "Weekends":
        return weekday >= 5
    elif repeat == "Weekly":
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
        return weekday == start_date.weekday()
    elif repeat == "Monthly":
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
        return now.day == start_date.day

    return True


class PlayerService:
    """
    Resolves the active playlist for a device based on schedule priority.

    Resolution order (highest to lowest):
        1. Emergency priority schedules
        2. High priority schedules
        3. Normal priority schedules
        4. Low priority schedules
        5. Directly assigned device playlist (via device_playlists table)
        6. No content (returns None → 204 No Content)
    """

    @staticmethod
    def get_current_playlist(
        db: Session, device_id: str, base_url: str = ""
    ) -> Optional[CurrentPlaylistResponse]:
        device = db.query(Device).filter(Device.id == device_id).first()
        if not device:
            return None

        now = datetime.now()
        current_date = now.strftime("%Y-%m-%d")
        current_time = now.strftime("%H:%M")

        # Find all active schedules assigned to this device
        # within the current date and time window
        schedules = (
            db.query(Schedule)
            .join(ScheduleDevice, Schedule.id == ScheduleDevice.scheduleId)
            .filter(
                ScheduleDevice.deviceId == device_id,
                Schedule.status == "Active",
                Schedule.startDate <= current_date,
                Schedule.endDate >= current_date,
                Schedule.startTime <= current_time,
                Schedule.endTime >= current_time,
            )
            .all()
        )

        # Filter by repeat pattern (Weekdays, Weekends, Weekly, Monthly)
        matching_schedules = [
            s for s in schedules
            if _matches_repeat(s.repeat, now, s.startDate)
        ]

        # Sort by priority descending — Emergency first, Low last
        matching_schedules.sort(
            key=lambda s: PRIORITY_ORDER.get(s.priority, 0),
            reverse=True,
        )

        playlist_id = None

        if matching_schedules:
            playlist_id = matching_schedules[0].playlistId
        else:
            # Fallback: directly assigned playlist
            device_playlist = (
                db.query(DevicePlaylist)
                .filter(DevicePlaylist.deviceId == device_id)
                .first()
            )
            if device_playlist:
                playlist_id = device_playlist.playlistId

        if not playlist_id:
            return None

        playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
        if not playlist:
            return None

        # Load ordered playlist items joined with media metadata
        items_with_media = (
            db.query(PlaylistItem, Media)
            .join(Media, PlaylistItem.mediaId == Media.id)
            .filter(PlaylistItem.playlistId == playlist_id)
            .order_by(PlaylistItem.order)
            .all()
        )

        print("========== PLAYLIST RESPONSE ==========")
        print("Playlist:", playlist.id)
        print("Updated:", playlist.updatedAt)
        for item, media in items_with_media:
            print(media.id, item.order)
        print("======================================")

        response_items = []
        for item, media in items_with_media:
            response_items.append(
                PlaylistItemWithMediaResponse(
                    id=item.id,
                    mediaId=item.mediaId,
                    order=item.order,
                    duration=item.duration,
                    media=PlaylistMediaItemResponse(
                        mediaId=media.id,
                        name=media.name,
                        type=media.type,
                        size=media.size,
                        duration=media.duration,
                        downloadUrl=f"{base_url}/media/{media.id}/download",
                        checksum=media.checksum,
                    ),
                )
            )

        return CurrentPlaylistResponse(
            playlistId=playlist.id,
            playlistName=playlist.name,
            playlistVersion=playlist.updatedAt,
            updatedAt=playlist.updatedAt,
            items=response_items,
            deviceOrientation=device.orientation,
        )
