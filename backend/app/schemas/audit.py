from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class AuditEventResponse(BaseModel):
    id: int
    at: int
    actorKind: str
    actorUserId: Optional[str] = None
    actorName: str
    actorRole: Optional[str] = None
    action: str
    entityType: str
    entityId: Optional[str] = None
    entityName: Optional[str] = None
    clientId: Optional[str] = None
    summary: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AuditPage(BaseModel):
    events: List[AuditEventResponse]
    # Pass as `before` to read the next, older page; null when there is nothing older.
    nextBefore: Optional[int] = None
