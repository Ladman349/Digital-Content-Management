from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.auth import Principal, _bearer_token, get_principal, login_enabled, require_admin
from app.database.database import get_db
from app.schemas.account import (
    AuthStatusResponse,
    ClientCreate,
    ClientResponse,
    ClientUpdate,
    HandoverRequest,
    HandoverResponse,
    LoginRequest,
    LoginResponse,
    PasswordChangeRequest,
    SessionResponse,
    UserCreate,
    UserResponse,
    UserUpdate,
)
from app.services.account_service import AccountService
from app.services.handover_service import HandoverService
from app.services.audit_service import AuditService, describe_changes

# ── Sign-in ─────────────────────────────────────────────────────────────────────────────
auth_router = APIRouter(prefix="/auth", tags=["Auth"])


def _caller_address(request: Request) -> str:
    # Railway and Vercel sit in front of the app, so the socket peer is the proxy. The first
    # X-Forwarded-For hop is the caller; it is only used to rate-limit, never to authorise.
    forwarded = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    return forwarded or (request.client.host if request.client else "unknown")


@auth_router.get("/status", response_model=AuthStatusResponse)
def auth_status(db: Session = Depends(get_db)):
    """Public. Tells the CMS whether to show a sign-in screen at all."""
    return AuthStatusResponse(loginRequired=login_enabled(db))


@auth_router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    token, expires_at, user = AccountService.login(
        db, payload.email, payload.password, _caller_address(request), request.headers.get("user-agent")
    )
    actor = Principal(kind="user", is_admin=user.role == "admin", user_id=user.id, user_name=user.name, client_id=user.clientId)
    AuditService.record(db, actor, "signed_in", "account", user.id, user.email, user.clientId, (request.headers.get("user-agent") or "")[:120] or None)
    return LoginResponse(token=token, expiresAt=expires_at, user=UserResponse.model_validate(user))


@auth_router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, db: Session = Depends(get_db)):
    AccountService.logout(db, _bearer_token(request))
    return None


def _signed_in_user(principal: Principal, db: Session):
    user = AccountService.get_user(db, principal.user_id) if principal.user_id else None
    if not user:
        raise HTTPException(status_code=404, detail="No user account is signed in.")
    return user


@auth_router.get("/me", response_model=UserResponse)
def me(principal: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    return _signed_in_user(principal, db)


@auth_router.post("/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: PasswordChangeRequest,
    request: Request,
    principal: Principal = Depends(get_principal),
    db: Session = Depends(get_db),
):
    user = _signed_in_user(principal, db)
    AccountService.change_password(db, user.id, payload.currentPassword, payload.newPassword, _bearer_token(request))
    AuditService.record(db, principal, "changed_password", "account", user.id, user.email, user.clientId)
    return None


@auth_router.get("/sessions", response_model=List[SessionResponse])
def my_sessions(request: Request, principal: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    """Everywhere the caller is signed in: their browsers and the phone apps."""
    user = _signed_in_user(principal, db)
    return AccountService.list_sessions(db, user.id, _bearer_token(request))


@auth_router.post("/sessions/end-others", status_code=status.HTTP_204_NO_CONTENT)
def end_my_other_sessions(request: Request, principal: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    user = _signed_in_user(principal, db)
    AccountService.end_other_sessions(db, user.id, _bearer_token(request))
    AuditService.record(db, principal, "signed_out_elsewhere", "account", user.id, user.email, user.clientId)
    return None


@auth_router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def end_my_session(session_id: str, principal: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    user = _signed_in_user(principal, db)
    if not AccountService.end_session(db, user.id, session_id):
        raise HTTPException(status_code=404, detail="Session not found")
    return None


# ── Users ───────────────────────────────────────────────────────────────────────────────
user_router = APIRouter(prefix="/users", tags=["Users"], dependencies=[Depends(require_admin)])


@user_router.get("", response_model=List[UserResponse])
def list_users(db: Session = Depends(get_db)):
    return AccountService.list_users(db)


@user_router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db), principal: Principal = Depends(require_admin)):
    user = AccountService.create_user(db, payload)
    AuditService.record(db, principal, "created", "user", user.id, user.email, None, f"{user.role}" + (f" of {user.clientName}" if user.clientName else ""))
    return user


@user_router.put("/{user_id}", response_model=UserResponse)
def update_user(user_id: str, payload: UserUpdate, db: Session = Depends(get_db), principal: Principal = Depends(require_admin)):
    user = AccountService.update_user(db, user_id, payload, principal.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    AuditService.record(db, principal, "updated", "user", user.id, user.email, None, describe_changes(payload.model_dump(exclude_unset=True)))
    return user


@user_router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: str, db: Session = Depends(get_db), principal: Principal = Depends(require_admin)):
    doomed = AccountService.get_user(db, user_id)
    email = doomed.email if doomed else None
    if not AccountService.delete_user(db, user_id, principal.user_id):
        raise HTTPException(status_code=404, detail="User not found")
    AuditService.record(db, principal, "deleted", "user", user_id, email)
    return None


# ── Clients ─────────────────────────────────────────────────────────────────────────────
client_router = APIRouter(prefix="/clients", tags=["Clients"], dependencies=[Depends(require_admin)])


@client_router.get("", response_model=List[ClientResponse])
def list_clients(db: Session = Depends(get_db)):
    return AccountService.list_clients(db)


@client_router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(payload: ClientCreate, db: Session = Depends(get_db), principal: Principal = Depends(require_admin)):
    client = AccountService.create_client(db, payload)
    AuditService.record(db, principal, "created", "client", client.id, client.name)
    return client


@client_router.put("/{client_id}", response_model=ClientResponse)
def update_client(client_id: str, payload: ClientUpdate, db: Session = Depends(get_db), principal: Principal = Depends(require_admin)):
    client = AccountService.update_client(db, client_id, payload)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    AuditService.record(db, principal, "updated", "client", client.id, client.name, None, f"name → {client.name}")
    return client


@client_router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(client_id: str, db: Session = Depends(get_db), principal: Principal = Depends(require_admin)):
    names = {c.id: c.name for c in AccountService.list_clients(db)}
    if not AccountService.delete_client(db, client_id):
        raise HTTPException(status_code=404, detail="Client not found")
    AuditService.record(db, principal, "deleted", "client", client_id, names.get(client_id))
    return None


# ── Handing screens over ────────────────────────────────────────────────────────────────
handover_router = APIRouter(prefix="/handover", tags=["Clients"], dependencies=[Depends(require_admin)])


@handover_router.post("", response_model=HandoverResponse)
def hand_over_screens(payload: HandoverRequest, db: Session = Depends(get_db), principal: Principal = Depends(require_admin)):
    """Moves screens to a client (or back to the operator) along with whatever only they play."""
    from app.models.device import Device

    previous = {d.id: d.clientId for d in db.query(Device).filter(Device.id.in_(payload.deviceIds)).all()} if payload.deviceIds else {}
    result = HandoverService.handover(db, payload)
    if result.applied:
        travelled = [i for i in result.moved if i.kind != "screen"]
        to = result.clientName or "the operator"
        for item in result.moved:
            if item.kind != "screen":
                continue
            summary = f"to {to}, with {len(travelled)} item(s) of content" + (f"; {len(result.left)} shared item(s) stayed" if result.left else "")
            AuditService.record(db, principal, "handed_over", "screen", item.id, item.name, result.clientId or previous.get(item.id), summary)
    return result
