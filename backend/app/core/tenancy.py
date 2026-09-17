"""
Per-client separation.

Screens, media, playlists and schedules each carry a nullable ``clientId``. These helpers are the
single place that decides what a caller may see and touch:

* a **client user** sees and changes only rows whose ``clientId`` is their own, and everything they
  create is stamped with it. A row they may not see is reported as *not found*, never *forbidden*,
  so ids belonging to other clients cannot be probed for;
* an **administrator** sees everything. When the CMS client switcher is set, lists narrow to that
  client and new rows are stamped with it, but lookups by id stay unrestricted.

Every service method takes ``principal`` as an optional last argument. ``None`` means "trusted
internal caller" (the player endpoints, scripts, older tests) and applies no restriction.
"""

from fastapi import HTTPException

from app.core.auth import Principal


def scope_query(query, model, principal: Principal | None):
    """Narrows a list query to what the caller should see."""
    if principal is not None and principal.scope_client_id is not None:
        return query.filter(model.clientId == principal.scope_client_id)
    return query


def can_access(obj, principal: Principal | None) -> bool:
    if obj is None:
        return False
    if principal is None or not principal.restricted:
        return True
    return obj.clientId is not None and obj.clientId == principal.client_id


def visible(obj, principal: Principal | None):
    """Returns the row, or None when the caller may not see it (which routers turn into a 404)."""
    return obj if can_access(obj, principal) else None


def owner_for_new(principal: Principal | None) -> str | None:
    """The clientId a newly created row receives."""
    return principal.scope_client_id if principal is not None else None


def ensure_referable(obj, principal: Principal | None, missing_detail: str) -> None:
    """
    Validates something a payload points at (media in a playlist, a screen in a schedule). A client
    user pointing at another client's row gets the same 400 as pointing at nothing.
    """
    if obj is None or not can_access(obj, principal):
        raise HTTPException(status_code=400, detail=missing_detail)


def apply_owner_change(obj, update_data: dict, principal: Principal | None, db=None) -> None:
    """
    Pops ``clientId`` out of an update payload and applies it for administrators only. Client users
    cannot move rows between clients, so the field is silently dropped for them.
    """
    if "clientId" not in update_data:
        return
    new_owner = update_data.pop("clientId") or None
    if principal is not None and principal.restricted:
        return
    if new_owner is not None and db is not None:
        from app.models.client import Client

        if not db.query(Client.id).filter(Client.id == new_owner).first():
            raise HTTPException(status_code=400, detail="The selected client does not exist.")
    obj.clientId = new_owner
