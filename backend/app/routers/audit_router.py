from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import Principal, get_principal
from app.database.database import get_db
from app.schemas.audit import AuditPage
from app.services.audit_service import AuditService

router = APIRouter(prefix="/activity", tags=["Activity"], dependencies=[Depends(get_principal)])


@router.get("", response_model=AuditPage)
def activity(
    limit: int = 50,
    before: Optional[int] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    actor_user_id: Optional[str] = None,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_principal),
):
    """Newest first. A client user sees what happened to their own client's rows, whoever did it."""
    return AuditService.page(db, principal, limit, before, entity_type, entity_id, actor_user_id)
