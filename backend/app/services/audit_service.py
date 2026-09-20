"""
The activity log: who changed what, and when.

Routers call `AuditService.record` after a change has succeeded. Recording must never be the reason
a request fails, so every error here is swallowed and logged; a missed log line is a smaller problem
than a playlist that could not be saved.

Reading follows the same separation as everything else. A client user sees what happened to their
own client's rows, whoever did it, so "who took my playlist off that screen?" has an answer.
Account and player-release entries carry no client and are for administrators only.
"""

import logging
import random
import time
from typing import Optional

from sqlalchemy import false
from sqlalchemy.orm import Session

from app.core.auth import Principal
from app.models.audit_event import AuditEvent
from app.schemas.audit import AuditEventResponse, AuditPage

logger = logging.getLogger("api")

RETENTION_MS = 400 * 24 * 60 * 60 * 1000
MAX_PAGE = 200

# How a changed field reads in a summary. Fields not listed are named as they are.
FIELD_LABELS = {
    "assignedDeviceIds": "screens",
    "deviceIds": "screens",
    "items": "sequence",
    "clientId": "owner",
    "playlistId": "playlist",
    "startDate": "start date",
    "endDate": "end date",
    "startTime": "start time",
    "endTime": "end time",
    "isActive": "active",
    "totalDuration": None,  # derived from the sequence; saying so twice is noise
    "updatedAt": None,
}
# Short values worth showing; anything else is only named.
_SHOWN_VALUES = {"status", "priority", "repeat", "orientation", "location", "role", "isActive", "name", "category"}


def describe_changes(data: dict) -> Optional[str]:
    """"name → Lobby, status → Published, screens" from an update payload. Never includes a password."""
    parts = []
    for key, value in data.items():
        if key == "password":
            parts.append("password reset")
            continue
        label = FIELD_LABELS.get(key, key)
        if label is None:
            continue
        if key in _SHOWN_VALUES and value is not None and len(str(value)) <= 60:
            shown = {True: "yes", False: "no"}.get(value, value) if isinstance(value, bool) else value
            parts.append(f"{label} → {shown}")
        else:
            parts.append(label)
    return ", ".join(parts) or None


class AuditService:

    @staticmethod
    def record(
        db: Session,
        principal: Optional[Principal],
        action: str,
        entity_type: str,
        entity_id: Optional[str] = None,
        entity_name: Optional[str] = None,
        client_id: Optional[str] = None,
        summary: Optional[str] = None,
        actor_name: Optional[str] = None,
    ) -> None:
        try:
            kind = principal.kind if principal else "system"
            name = actor_name or (principal.user_name if principal else None)
            if not name:
                name = {"key": "Admin key", "open": "Anyone (sign-in was off)"}.get(kind, "System")
            role = None
            if principal is not None and principal.kind == "user":
                role = "admin" if principal.is_admin else "client"

            now = int(time.time() * 1000)
            event = AuditEvent(
                at=now,
                actorKind=kind,
                actorUserId=principal.user_id if principal else None,
                actorName=name[:120],
                actorRole=role,
                action=action,
                entityType=entity_type,
                entityId=str(entity_id)[:120] if entity_id is not None else None,
                entityName=(entity_name or None) and str(entity_name)[:200],
                clientId=client_id,
                summary=(summary or None) and summary[:500],
            )
            # A savepoint, so that a failed insert undoes itself and nothing else: the caller's
            # rows stay loaded and the response can still be built from them.
            with db.begin_nested():
                db.add(event)
                if random.random() < 0.005:
                    db.query(AuditEvent).filter(AuditEvent.at < now - RETENTION_MS).delete(synchronize_session=False)
            db.commit()
        except Exception as exc:  # noqa: BLE001 - the log must never break the request it describes
            logger.error(f"Could not write audit event {action} {entity_type} {entity_id}: {exc}")
            if not db.is_active:
                db.rollback()

    @staticmethod
    def page(
        db: Session,
        principal: Principal,
        limit: int = 50,
        before: Optional[int] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        actor_user_id: Optional[str] = None,
    ) -> AuditPage:
        limit = max(1, min(limit, MAX_PAGE))
        query = db.query(AuditEvent)

        if principal.restricted:
            query = query.filter(AuditEvent.clientId == principal.client_id) if principal.client_id else query.filter(false())
        elif principal.scope_client_id is not None:
            query = query.filter(AuditEvent.clientId == principal.scope_client_id)

        if before is not None:
            query = query.filter(AuditEvent.id < before)
        if entity_type:
            query = query.filter(AuditEvent.entityType == entity_type)
        if entity_id:
            query = query.filter(AuditEvent.entityId == entity_id)
        if actor_user_id:
            query = query.filter(AuditEvent.actorUserId == actor_user_id)

        rows = query.order_by(AuditEvent.id.desc()).limit(limit + 1).all()
        events = [AuditEventResponse.model_validate(r) for r in rows[:limit]]
        return AuditPage(events=events, nextBefore=events[-1].id if len(rows) > limit and events else None)
