"""
Proof of play: counting what screens report, and reading it back.

Players send batches of "this file played from then for this long". They are folded into hourly
counters (see `PlayStat`) rather than kept one row per play.

Who may read a count follows the same separation as everything else, with one addition that
advertising needs: a client sees plays **on their screens** and plays **of their media**, wherever
it ran. While the screen or file still exists its current owner decides, so history travels with a
handover; once it is deleted, the owner recorded at the time of play decides.
"""

import csv
import datetime
import io
import logging
import time
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy import BigInteger, and_, false, func, literal_column, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.time_util import IST_OFFSET
from app.models.device import Device
from app.models.media import Media
from app.models.play_stat import PlayBatch, PlayStat
from app.models.playlist import Playlist
from app.schemas.report import (
    PlayBatchRequest,
    PlayBatchResponse,
    PlayReport,
    ReportDay,
    ReportHour,
    ReportRow,
    ReportTotals,
)

logger = logging.getLogger("api")

HOUR_MS = 60 * 60 * 1000
DAY_MS = 24 * HOUR_MS
# The platform keeps one local time (see time_util). It has no daylight saving, so a fixed offset
# is exact and keeps the bucket arithmetic portable between PostgreSQL and SQLite.
TZ_OFFSET_MS = int(IST_OFFSET.utcoffset(None).total_seconds() * 1000)
TZ_NAME = "Asia/Kolkata"

# A device whose clock is this far from the server's has its timestamps shifted by the difference.
CLOCK_SKEW_TOLERANCE_MS = 2 * 60 * 1000
# A player can be offline for weeks and still deliver; older than this is more likely a bad clock.
MAX_EVENT_AGE_MS = 62 * DAY_MS
MAX_FUTURE_MS = 10 * 60 * 1000
BATCH_MEMORY_MS = 30 * DAY_MS
MAX_REPORT_DAYS = 366

# Inlined rather than bound: PostgreSQL only accepts a GROUP BY expression as matching the SELECT one
# when the two are textually identical, which separate bind parameters are not under every driver.
# Typed as integers so that `//` renders as plain integer division; untyped, SQLAlchemy wraps it in
# FLOOR(), which yields a double on PostgreSQL and then has no `%` operator. SQLite hides this, so
# tests/test_reports_postgres_sql.py pins the rendered SQL.
_OFFSET, _HOUR, _DAY, _24 = (literal_column(str(v), type_=BigInteger) for v in (TZ_OFFSET_MS, HOUR_MS, DAY_MS, 24))


def _now_ms() -> int:
    return int(time.time() * 1000)


def hour_start(epoch_ms: int) -> int:
    """Start of the platform-local hour containing this instant, as epoch milliseconds."""
    return ((epoch_ms + TZ_OFFSET_MS) // HOUR_MS) * HOUR_MS - TZ_OFFSET_MS


def _day_bounds(day: datetime.date) -> int:
    """Epoch milliseconds of platform-local midnight at the start of `day`."""
    midnight = datetime.datetime(day.year, day.month, day.day, tzinfo=datetime.timezone.utc)
    return int(midnight.timestamp() * 1000) - TZ_OFFSET_MS


class ReportService:

    # ── Ingest ──────────────────────────────────────────────────────────────────────────
    @staticmethod
    def record_batch(db: Session, device: Device, payload: PlayBatchRequest) -> PlayBatchResponse:
        now = _now_ms()
        batch_id = f"{device.id}:{payload.batchId}"

        if db.query(PlayBatch.batchId).filter(PlayBatch.batchId == batch_id).first():
            return PlayBatchResponse(accepted=0, rejected=0, duplicate=True)

        skew = now - payload.sentAt
        if abs(skew) <= CLOCK_SKEW_TOLERANCE_MS:
            skew = 0

        media_ids = {e.mediaId for e in payload.events}
        playlist_ids = {e.playlistId for e in payload.events if e.playlistId}
        media = {m.id: m for m in db.query(Media).filter(Media.id.in_(media_ids)).all()} if media_ids else {}
        playlists = {p.id: p.name for p in db.query(Playlist.id, Playlist.name).filter(Playlist.id.in_(playlist_ids)).all()} if playlist_ids else {}
        # A file deleted since it played still counts, as long as this screen has reported it before.
        known_gone = set()
        unknown = media_ids - set(media)
        if unknown:
            rows = db.query(PlayStat.mediaId).filter(PlayStat.deviceId == device.id, PlayStat.mediaId.in_(unknown)).distinct().all()
            known_gone = {r[0] for r in rows}

        buckets: dict[tuple, dict] = {}
        rejected = 0
        for event in payload.events:
            started = event.startedAt + skew
            if event.mediaId not in media and event.mediaId not in known_gone:
                rejected += 1
                continue
            if started > now + MAX_FUTURE_MS or started < now - MAX_EVENT_AGE_MS:
                rejected += 1
                continue
            key = (event.mediaId, event.playlistId or "", hour_start(started))
            bucket = buckets.setdefault(key, {"plays": 0, "completed": 0, "duration": 0, "last": 0})
            bucket["plays"] += 1
            bucket["completed"] += 1 if event.completed else 0
            bucket["duration"] += event.durationMs
            bucket["last"] = max(bucket["last"], started)

        try:
            for (media_id, playlist_id, hour), counts in buckets.items():
                stat = (
                    db.query(PlayStat)
                    .filter(PlayStat.deviceId == device.id, PlayStat.mediaId == media_id, PlayStat.playlistId == playlist_id, PlayStat.hourStart == hour)
                    .first()
                )
                if stat is None:
                    stat = PlayStat(deviceId=device.id, mediaId=media_id, playlistId=playlist_id, hourStart=hour, plays=0, completedPlays=0, durationMs=0, lastPlayedAt=0)
                    db.add(stat)
                stat.plays += counts["plays"]
                stat.completedPlays += counts["completed"]
                stat.durationMs += counts["duration"]
                stat.lastPlayedAt = max(stat.lastPlayedAt or 0, counts["last"])
                stat.deviceName = device.name
                stat.deviceClientId = device.clientId
                item = media.get(media_id)
                if item is not None:
                    stat.mediaName, stat.mediaType, stat.mediaClientId = item.name, item.type, item.clientId
                if playlist_id in playlists:
                    stat.playlistName = playlists[playlist_id]

            db.add(PlayBatch(batchId=batch_id, deviceId=device.id, receivedAt=now))
            db.query(PlayBatch).filter(PlayBatch.receivedAt < now - BATCH_MEMORY_MS).delete(synchronize_session=False)
            db.commit()
        except IntegrityError:
            # Two uploads from one screen raced for the same bucket. Nothing was counted; the
            # player keeps the batch and sends it again.
            db.rollback()
            raise HTTPException(status_code=409, detail="Another upload from this screen is in progress. Try again.")

        accepted = len(payload.events) - rejected
        if rejected:
            logger.warning(f"Play batch from {device.id}: {accepted} accepted, {rejected} rejected (unknown media or implausible time)")
        return PlayBatchResponse(accepted=accepted, rejected=rejected)

    # ── Reading ─────────────────────────────────────────────────────────────────────────
    @staticmethod
    def _base(db: Session, principal, date_from: datetime.date, date_to: datetime.date, device_id: Optional[str], media_id: Optional[str], playlist_id: Optional[str]):
        """PlayStat joined to whatever still exists, narrowed to the range, the filters and the caller."""
        query = (
            db.query(PlayStat)
            .outerjoin(Device, Device.id == PlayStat.deviceId)
            .outerjoin(Media, Media.id == PlayStat.mediaId)
            .outerjoin(Playlist, Playlist.id == PlayStat.playlistId)
            .filter(PlayStat.hourStart >= _day_bounds(date_from), PlayStat.hourStart < _day_bounds(date_to) + DAY_MS)
        )
        if device_id:
            query = query.filter(PlayStat.deviceId == device_id)
        if media_id:
            query = query.filter(PlayStat.mediaId == media_id)
        if playlist_id:
            query = query.filter(PlayStat.playlistId == playlist_id)

        if principal is not None:
            client_id = principal.client_id if principal.restricted else principal.scope_client_id
            if principal.restricted and client_id is None:
                query = query.filter(false())
            elif client_id is not None:
                query = query.filter(
                    or_(
                        Device.clientId == client_id,
                        Media.clientId == client_id,
                        and_(Device.id.is_(None), PlayStat.deviceClientId == client_id),
                        and_(Media.id.is_(None), PlayStat.mediaClientId == client_id),
                    )
                )
        return query

    @staticmethod
    def _range(date_from: Optional[datetime.date], date_to: Optional[datetime.date]):
        today = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(milliseconds=TZ_OFFSET_MS)).date()
        date_to = date_to or today
        date_from = date_from or date_to - datetime.timedelta(days=6)
        if date_from > date_to:
            raise HTTPException(status_code=400, detail="The start date cannot be after the end date.")
        if (date_to - date_from).days + 1 > MAX_REPORT_DAYS:
            raise HTTPException(status_code=400, detail=f"A report can cover at most {MAX_REPORT_DAYS} days.")
        return date_from, date_to

    _SUMS = (
        func.coalesce(func.sum(PlayStat.plays), 0),
        func.coalesce(func.sum(PlayStat.completedPlays), 0),
        func.coalesce(func.sum(PlayStat.durationMs), 0),
        func.coalesce(func.max(PlayStat.lastPlayedAt), 0),
    )

    @staticmethod
    def _rows(base, id_column, live_name, snapshot_name, live_id, kind_column=None, limit: int = 200) -> List[ReportRow]:
        columns = [id_column, func.max(live_name), func.max(snapshot_name), func.max(live_id), *ReportService._SUMS]
        if kind_column is not None:
            columns.append(func.max(kind_column))
        result = base.with_entities(*columns).group_by(id_column).order_by(ReportService._SUMS[0].desc()).limit(limit).all()
        rows = []
        for record in result:
            row_id, live, snapshot, exists_id, plays, completed, duration, last = record[:8]
            rows.append(
                ReportRow(
                    id=row_id, name=live or snapshot or row_id, exists=exists_id is not None, kind=record[8] if kind_column is not None else None,
                    plays=int(plays), completedPlays=int(completed), durationMs=int(duration), lastPlayedAt=int(last),
                )
            )
        return rows

    @staticmethod
    def report(db: Session, principal, date_from=None, date_to=None, device_id=None, media_id=None, playlist_id=None) -> PlayReport:
        date_from, date_to = ReportService._range(date_from, date_to)
        base = ReportService._base(db, principal, date_from, date_to, device_id, media_id, playlist_id)

        plays, completed, duration, last = base.with_entities(*ReportService._SUMS).one()
        screens, files = base.with_entities(func.count(func.distinct(PlayStat.deviceId)), func.count(func.distinct(PlayStat.mediaId))).one()
        totals = ReportTotals(
            plays=int(plays), completedPlays=int(completed), durationMs=int(duration), screens=int(screens), mediaFiles=int(files),
            lastPlayedAt=int(last) or None,
        )

        # Every day and hour is returned, zeros included, so a chart needs no gap filling.
        day_index = (PlayStat.hourStart + _OFFSET) // _DAY
        per_day = {int(d): (int(p), int(ms)) for d, p, ms in base.with_entities(day_index, ReportService._SUMS[0], ReportService._SUMS[2]).group_by(day_index).all()}
        by_day = []
        for offset in range((date_to - date_from).days + 1):
            day = date_from + datetime.timedelta(days=offset)
            index = (_day_bounds(day) + TZ_OFFSET_MS) // DAY_MS
            day_plays, day_ms = per_day.get(index, (0, 0))
            by_day.append(ReportDay(date=day.isoformat(), plays=day_plays, durationMs=day_ms))

        hour_index = ((PlayStat.hourStart + _OFFSET) // _HOUR) % _24
        per_hour = {int(h): (int(p), int(ms)) for h, p, ms in base.with_entities(hour_index, ReportService._SUMS[0], ReportService._SUMS[2]).group_by(hour_index).all()}
        by_hour = [ReportHour(hour=h, plays=per_hour.get(h, (0, 0))[0], durationMs=per_hour.get(h, (0, 0))[1]) for h in range(24)]

        return PlayReport(
            dateFrom=date_from.isoformat(),
            dateTo=date_to.isoformat(),
            timezone=TZ_NAME,
            totals=totals,
            byDay=by_day,
            byHour=by_hour,
            byMedia=ReportService._rows(base, PlayStat.mediaId, Media.name, PlayStat.mediaName, Media.id, func.coalesce(Media.type, PlayStat.mediaType)),
            byDevice=ReportService._rows(base, PlayStat.deviceId, Device.name, PlayStat.deviceName, Device.id),
            byPlaylist=ReportService._rows(base.filter(PlayStat.playlistId != ""), PlayStat.playlistId, Playlist.name, PlayStat.playlistName, Playlist.id),
        )

    @staticmethod
    def export_csv(db: Session, principal, date_from=None, date_to=None, device_id=None, media_id=None, playlist_id=None) -> tuple[str, str]:
        """One line per day, screen, file and playlist. Returns (filename, csv text)."""
        date_from, date_to = ReportService._range(date_from, date_to)
        base = ReportService._base(db, principal, date_from, date_to, device_id, media_id, playlist_id)
        day_index = (PlayStat.hourStart + _OFFSET) // _DAY
        records = (
            base.with_entities(
                day_index, PlayStat.deviceId, func.max(func.coalesce(Device.name, PlayStat.deviceName)), PlayStat.mediaId,
                func.max(func.coalesce(Media.name, PlayStat.mediaName)), func.max(func.coalesce(Playlist.name, PlayStat.playlistName)),
                *ReportService._SUMS[:3],
            )
            .group_by(day_index, PlayStat.deviceId, PlayStat.mediaId, PlayStat.playlistId)
            .order_by(day_index, PlayStat.deviceId, ReportService._SUMS[0].desc())
            .all()
        )

        def safe(value) -> str:
            # Names come from uploads and free text. A spreadsheet runs a cell that starts with one
            # of these as a formula, so such cells are made plain text.
            text = "" if value is None else str(value)
            return "'" + text if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text

        out = io.StringIO()
        writer = csv.writer(out, lineterminator="\r\n")
        writer.writerow(["Date", "Screen", "Screen ID", "Media", "Media ID", "Playlist", "Plays", "Completed plays", "Seconds on screen"])
        epoch = datetime.date(1970, 1, 1)
        for day, device_id_, device_name, media_id_, media_name, playlist_name, plays, completed, duration in records:
            writer.writerow([
                (epoch + datetime.timedelta(days=int(day))).isoformat(), safe(device_name or device_id_), device_id_, safe(media_name or media_id_), media_id_,
                safe(playlist_name), int(plays), int(completed), round(int(duration) / 1000),
            ])
        return f"proof-of-play_{date_from.isoformat()}_{date_to.isoformat()}.csv", out.getvalue()
