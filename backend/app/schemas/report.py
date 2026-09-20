from typing import List, Optional

from pydantic import BaseModel, Field


# ── What a player sends ─────────────────────────────────────────────────────────────────
class PlayEvent(BaseModel):
    mediaId: str = Field(min_length=1, max_length=64)
    playlistId: Optional[str] = Field(default=None, max_length=64)
    # Epoch milliseconds on the device's own clock; the batch's sentAt lets the server correct it.
    startedAt: int
    durationMs: int = Field(ge=0, le=24 * 60 * 60 * 1000)
    # False when the item was cut short, for instance by a new playlist arriving.
    completed: bool = True


class PlayBatchRequest(BaseModel):
    # Chosen by the player and resent unchanged on retry, which is what makes a retry harmless.
    batchId: str = Field(min_length=8, max_length=64)
    # The device's clock at the moment of sending.
    sentAt: int
    events: List[PlayEvent] = Field(max_length=500)


class PlayBatchResponse(BaseModel):
    accepted: int
    rejected: int
    duplicate: bool = False


# ── What the CMS reads ──────────────────────────────────────────────────────────────────
class ReportTotals(BaseModel):
    plays: int = 0
    completedPlays: int = 0
    durationMs: int = 0
    screens: int = 0
    mediaFiles: int = 0
    lastPlayedAt: Optional[int] = None


class ReportRow(BaseModel):
    id: str
    name: str
    # Media type for media rows; nothing otherwise.
    kind: Optional[str] = None
    # False once the screen, file or playlist itself has been deleted.
    exists: bool = True
    plays: int
    completedPlays: int
    durationMs: int
    lastPlayedAt: int


class ReportDay(BaseModel):
    date: str
    plays: int = 0
    durationMs: int = 0


class ReportHour(BaseModel):
    hour: int
    plays: int = 0
    durationMs: int = 0


class PlayReport(BaseModel):
    dateFrom: str
    dateTo: str
    timezone: str
    totals: ReportTotals
    byDay: List[ReportDay]
    byHour: List[ReportHour]
    byMedia: List[ReportRow]
    byDevice: List[ReportRow]
    byPlaylist: List[ReportRow]
