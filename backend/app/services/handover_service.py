"""
Handing screens to a client together with what they play.

A screen on its own is little use to a client: if its playlist, media and schedules stay with the
operator, the client sees a screen that appears to show nothing. This works out what can travel
with the screens and moves it in one step.

The rule is that a row moves only when nothing left behind still depends on it:

* a **schedule** moves when every screen it runs on is being handed over or is already the
  receiving client's;
* a **playlist** moves when every screen it is assigned to, and every schedule that plays it,
  is moving or already the receiving client's;
* a **media file** moves when every playlist using it is moving or already the receiving client's.

Anything else is left exactly where it is and reported with the reason, so the screen keeps
playing and the administrator can decide what to do about the shared piece. Rows are only ever
taken from the owner the screens are coming from: a third client's playlist that happens to be on
the screen is never moved.
"""

from typing import Iterable, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.device import Device
from app.models.device_playlist import DevicePlaylist
from app.models.media import Media
from app.models.playlist import Playlist
from app.models.playlist_item import PlaylistItem
from app.models.schedule import Schedule
from app.models.schedule_device import ScheduleDevice
from app.schemas.account import HandoverItem, HandoverLeftItem, HandoverRequest, HandoverResponse

OPERATOR = "the operator"


class HandoverService:

    @staticmethod
    def _owner_label(clients: dict, client_id: Optional[str]) -> str:
        return clients.get(client_id, "another client") if client_id else OPERATOR

    @staticmethod
    def _names(rows: Iterable, limit: int = 2) -> str:
        names = [f"“{row.name}”" for row in rows]
        if len(names) > limit:
            return f"{', '.join(names[:limit])} and {len(names) - limit} more"
        return " and ".join(names)

    @staticmethod
    def handover(db: Session, payload: HandoverRequest) -> HandoverResponse:
        device_ids = list(dict.fromkeys(payload.deviceIds))
        if not device_ids:
            raise HTTPException(status_code=400, detail="Choose at least one screen.")

        target = payload.clientId or None
        clients = {c.id: c.name for c in db.query(Client).all()}
        if target is not None and target not in clients:
            raise HTTPException(status_code=400, detail="The selected client does not exist.")

        devices = db.query(Device).filter(Device.id.in_(device_ids)).all()
        missing = set(device_ids) - {d.id for d in devices}
        if missing:
            raise HTTPException(status_code=400, detail=f"Screen {sorted(missing)[0]} does not exist.")

        moving_devices = [d for d in devices if d.clientId != target]
        moving_ids = {d.id for d in moving_devices}
        # Content is only ever taken from whoever the screens are coming from.
        from_owners = {d.clientId for d in moving_devices}

        moved = [HandoverItem(kind="screen", id=d.id, name=d.name) for d in moving_devices]
        left: list[HandoverLeftItem] = []
        rows_to_move: list = list(moving_devices)

        if payload.includeContent and moving_ids:
            schedules, playlists, media = HandoverService._plan_content(db, moving_ids, from_owners, target, clients, left)
            for kind, rows in (("schedule", schedules), ("playlist", playlists), ("media", media)):
                moved.extend(HandoverItem(kind=kind, id=row.id, name=row.name) for row in rows)
                rows_to_move.extend(rows)

        if not payload.dryRun:
            for row in rows_to_move:
                row.clientId = target
            db.commit()

        return HandoverResponse(
            clientId=target,
            clientName=clients.get(target) if target else None,
            applied=not payload.dryRun,
            moved=moved,
            left=left,
        )

    @staticmethod
    def _plan_content(db: Session, moving_ids: set, from_owners: set, target, clients: dict, left: list):
        all_devices = {d.id: d for d in db.query(Device).all()}

        def stays(device_id: str) -> bool:
            device = all_devices.get(device_id)
            return device is not None and device_id not in moving_ids and device.clientId != target

        def leave(kind: str, row, reason: str) -> None:
            left.append(HandoverLeftItem(kind=kind, id=row.id, name=row.name, reason=reason))

        def foreign(row) -> Optional[str]:
            """Why a row cannot be taken at all, or None when it can be considered."""
            if row.clientId not in from_owners:
                return f"It belongs to {HandoverService._owner_label(clients, row.clientId)}."
            return None

        # ── Schedules that run on the screens being handed over ─────────────────────────
        schedule_ids = {r[0] for r in db.query(ScheduleDevice.scheduleId).filter(ScheduleDevice.deviceId.in_(moving_ids)).all()}
        touched_schedules = db.query(Schedule).filter(Schedule.id.in_(schedule_ids)).all() if schedule_ids else []
        moving_schedules = []
        for schedule in touched_schedules:
            if schedule.clientId == target:
                continue
            staying = [all_devices[d] for d in schedule.deviceIds if stays(d)]
            reason = foreign(schedule)
            if not reason and staying:
                reason = f"It also runs on {HandoverService._names(staying)}, which {'is' if len(staying) == 1 else 'are'} not being handed over."
            if reason:
                leave("schedule", schedule, reason)
            else:
                moving_schedules.append(schedule)
        moving_schedule_ids = {s.id for s in moving_schedules}

        # ── Playlists those screens play, directly or through a schedule ────────────────
        playlist_ids = {r[0] for r in db.query(DevicePlaylist.playlistId).filter(DevicePlaylist.deviceId.in_(moving_ids)).all()}
        playlist_ids |= {s.playlistId for s in touched_schedules}
        touched_playlists = db.query(Playlist).filter(Playlist.id.in_(playlist_ids)).all() if playlist_ids else []
        moving_playlists = []
        for playlist in touched_playlists:
            if playlist.clientId == target:
                continue
            reason = foreign(playlist)
            if not reason:
                staying = [all_devices[d] for d in playlist.assignedDeviceIds if stays(d)]
                if staying:
                    reason = f"It is also assigned to {HandoverService._names(staying)}, which {'is' if len(staying) == 1 else 'are'} not being handed over."
            if not reason:
                users = db.query(Schedule).filter(Schedule.playlistId == playlist.id).all()
                staying = [s for s in users if s.id not in moving_schedule_ids and s.clientId != target]
                if staying:
                    reason = f"The schedule {HandoverService._names(staying)} also plays it and is staying behind."
            if reason:
                leave("playlist", playlist, reason)
            else:
                moving_playlists.append(playlist)
        moving_playlist_ids = {p.id for p in moving_playlists}

        # ── Media used by those playlists ───────────────────────────────────────────────
        media_ids = set()
        if playlist_ids:
            media_ids = {r[0] for r in db.query(PlaylistItem.mediaId).filter(PlaylistItem.playlistId.in_(playlist_ids)).all()}
        touched_media = db.query(Media).filter(Media.id.in_(media_ids)).all() if media_ids else []
        moving_media = []
        for media in touched_media:
            if media.clientId == target:
                continue
            reason = foreign(media)
            if not reason:
                user_ids = {r[0] for r in db.query(PlaylistItem.playlistId).filter(PlaylistItem.mediaId == media.id).all()}
                users = db.query(Playlist).filter(Playlist.id.in_(user_ids)).all()
                staying = [p for p in users if p.id not in moving_playlist_ids and p.clientId != target]
                if staying:
                    reason = f"The playlist {HandoverService._names(staying)} also uses it and is staying behind."
            if reason:
                leave("media", media, reason)
            else:
                moving_media.append(media)

        return moving_schedules, moving_playlists, moving_media
