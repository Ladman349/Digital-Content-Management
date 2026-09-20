import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.auth import Principal, get_principal
from app.database.database import get_db
from app.schemas.report import PlayReport
from app.services.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["Reports"], dependencies=[Depends(get_principal)])


@router.get("/plays", response_model=PlayReport)
def play_report(
    date_from: Optional[datetime.date] = None,
    date_to: Optional[datetime.date] = None,
    device_id: Optional[str] = None,
    media_id: Optional[str] = None,
    playlist_id: Optional[str] = None,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    """Proof of play for a date range (the last seven days by default), in the platform's local time."""
    return ReportService.report(db, principal, date_from, date_to, device_id, media_id, playlist_id)


@router.get("/plays.csv")
def play_report_csv(
    date_from: Optional[datetime.date] = None,
    date_to: Optional[datetime.date] = None,
    device_id: Optional[str] = None,
    media_id: Optional[str] = None,
    playlist_id: Optional[str] = None,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    filename, body = ReportService.export_csv(db, principal, date_from, date_to, device_id, media_id, playlist_id)
    # The byte-order mark is what makes Excel read the file as UTF-8 rather than mangling names.
    return Response(
        content="﻿" + body,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"', "Cache-Control": "no-store"},
    )
