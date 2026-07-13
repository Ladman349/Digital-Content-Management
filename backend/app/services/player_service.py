from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from app.core.time_util import now_ist

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


def _matches_repeat(repeat: str, now: datetime, start_date_val) -> bool:
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

    if isinstance(start_date_val, str):
        start_date = datetime.strptime(start_date_val, "%Y-%m-%d").date()
    elif isinstance(start_date_val, datetime):
        start_date = start_date_val.date()
    else:
        start_date = start_date_val

    if repeat == "Weekdays":
        return weekday < 5
    elif repeat == "Weekends":
        return weekday >= 5
    elif repeat == "Weekly":
        return weekday == start_date.weekday()
    elif repeat == "Monthly":
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
            print(f"[204-DIAG] Device '{device_id}' not found in database.")
            return None

        utc_now = datetime.now(timezone.utc)
        now = now_ist()
        current_date = now.strftime("%Y-%m-%d")
        current_time = now.strftime("%H:%M")

        print(f"[204-DIAG] ── Resolving playlist for device '{device_id}' ──")
        print(f"[204-DIAG]   UTC clock     : {utc_now.isoformat()}")
        print(f"[204-DIAG]   IST clock     : {now.isoformat()}")
        print(f"[204-DIAG]   current_date  : {current_date}")
        print(f"[204-DIAG]   current_time  : {current_time}")
        print(f"[204-DIAG]   timezone      : Asia/Kolkata")

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

        # --- diagnostic: also fetch ALL schedules assigned to this device so we can
        # show why non-matching ones were rejected --------------------------------
        all_assigned = (
            db.query(Schedule)
            .join(ScheduleDevice, Schedule.id == ScheduleDevice.scheduleId)
            .filter(ScheduleDevice.deviceId == device_id)
            .all()
        )

        print(f"[204-DIAG]   Total schedules assigned to device : {len(all_assigned)}")
        for s in all_assigned:
            reasons = []
            s_start_date_str = s.startDate.isoformat() if hasattr(s.startDate, "isoformat") else str(s.startDate)
            s_end_date_str = s.endDate.isoformat() if hasattr(s.endDate, "isoformat") else str(s.endDate)
            s_start_time_str = s.startTime.strftime("%H:%M") if hasattr(s.startTime, "strftime") else str(s.startTime)
            s_end_time_str = s.endTime.strftime("%H:%M") if hasattr(s.endTime, "strftime") else str(s.endTime)

            if s.status != "Active":
                reasons.append(f"status='{s.status}' (need 'Active')")
            if s_start_date_str > current_date:
                reasons.append(f"startDate={s_start_date_str} is in the future")
            if s_end_date_str < current_date:
                reasons.append(f"endDate={s_end_date_str} is in the past")
            if s_start_time_str > current_time:
                reasons.append(f"startTime={s_start_time_str} > current_time={current_time}")
            if s_end_time_str < current_time:
                reasons.append(f"endTime={s_end_time_str} < current_time={current_time}")
            if reasons:
                print(f"[204-DIAG]   ✗ Schedule '{s.id}' REJECTED: {'; '.join(reasons)}")
            else:
                print(f"[204-DIAG]   ✔ Schedule '{s.id}' PASSED date/time/status filters (repeat={s.repeat}, playlist={s.playlistId})")

        print(f"[204-DIAG]   Schedules passing date+time+status filter : {len(schedules)}")

        # Filter by repeat pattern (Weekdays, Weekends, Weekly, Monthly)
        matching_schedules = []
        for s in schedules:
            if _matches_repeat(s.repeat, now, s.startDate):
                matching_schedules.append(s)
            else:
                print(f"[204-DIAG]   ✗ Schedule '{s.id}' REJECTED by repeat rule: repeat='{s.repeat}', weekday={now.weekday()} (0=Mon)")

        # Sort by priority descending — Emergency first, Low last
        matching_schedules.sort(
            key=lambda s: PRIORITY_ORDER.get(s.priority, 0),
            reverse=True,
        )

        playlist_id = None

        if matching_schedules:
            playlist_id = matching_schedules[0].playlistId
            print(f"[204-DIAG]   ✔ Winning schedule '{matching_schedules[0].id}' → playlist '{playlist_id}'")
        else:
            print(f"[204-DIAG]   No matching schedule. Checking direct device playlist fallback...")
            # Fallback: directly assigned playlist
            device_playlist = (
                db.query(DevicePlaylist)
                .filter(DevicePlaylist.deviceId == device_id)
                .first()
            )
            if device_playlist:
                playlist_id = device_playlist.playlistId
                print(f"[204-DIAG]   ✔ Fallback direct playlist found: '{playlist_id}'")
            else:
                print(f"[204-DIAG]   ✗ No direct playlist assigned either. → 204 No Content")

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
