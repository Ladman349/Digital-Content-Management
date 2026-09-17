"""
Sign-in, users and clients.

Rules that protect the operator from locking themselves out live here rather than in the routers:
the first account must be an administrator, and the last active administrator can be neither
deleted, deactivated nor demoted.
"""

import logging
import threading
import time
import uuid
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth import reset_login_state
from app.core.config import settings
from app.core.security import (
    PASSWORD_MIN_LENGTH,
    burn_password_check,
    hash_password,
    hash_token,
    new_session_token,
    verify_password,
)
from app.models.client import Client
from app.models.device import Device
from app.models.media import Media
from app.models.playlist import Playlist
from app.models.schedule import Schedule
from app.models.user import ROLE_ADMIN, ROLE_CLIENT, User, UserSession
from app.schemas.account import ClientCreate, ClientResponse, ClientUpdate, UserCreate, UserUpdate

logger = logging.getLogger("api")


def _now_ms() -> int:
    return int(time.time() * 1000)


class LoginThrottle:
    """
    Slows password guessing: after a handful of failures for one email, or a larger number from one
    address, further attempts are refused for a while. In-memory and per-process, which is enough to
    make online guessing impractical without adding infrastructure.
    """

    WINDOW_SECONDS = 15 * 60
    MAX_PER_EMAIL = 5
    MAX_PER_ADDRESS = 30
    _MAX_KEYS = 5000

    _failures: dict[str, list[float]] = {}
    _lock = threading.Lock()

    @classmethod
    def _recent(cls, key: str, now: float) -> list[float]:
        recent = [t for t in cls._failures.get(key, ()) if now - t < cls.WINDOW_SECONDS]
        if recent:
            cls._failures[key] = recent
        else:
            cls._failures.pop(key, None)
        return recent

    @classmethod
    def retry_after(cls, email: str, address: str) -> int:
        """Seconds until another attempt is allowed, or 0 when one is allowed now."""
        now = time.time()
        with cls._lock:
            for key, limit in ((f"e:{email}", cls.MAX_PER_EMAIL), (f"a:{address}", cls.MAX_PER_ADDRESS)):
                recent = cls._recent(key, now)
                if len(recent) >= limit:
                    return max(1, int(cls.WINDOW_SECONDS - (now - recent[0])))
        return 0

    @classmethod
    def record_failure(cls, email: str, address: str) -> None:
        now = time.time()
        with cls._lock:
            if len(cls._failures) > cls._MAX_KEYS:
                cls._failures.clear()
            for key in (f"e:{email}", f"a:{address}"):
                cls._failures.setdefault(key, []).append(now)

    @classmethod
    def record_success(cls, email: str) -> None:
        with cls._lock:
            cls._failures.pop(f"e:{email}", None)

    @classmethod
    def reset(cls) -> None:
        with cls._lock:
            cls._failures.clear()


class AccountService:

    # ── Sign-in ─────────────────────────────────────────────────────────────────────────
    @staticmethod
    def login(db: Session, email: str, password: str, address: str, user_agent: Optional[str]):
        email = (email or "").strip().lower()

        wait = LoginThrottle.retry_after(email, address)
        if wait:
            raise HTTPException(
                status_code=429,
                detail="Too many sign-in attempts. Try again in a few minutes.",
                headers={"Retry-After": str(wait)},
            )

        user = db.query(User).filter(User.email == email).first()
        if user:
            ok = verify_password(password or "", user.passwordHash)
        else:
            burn_password_check(password or "")
            ok = False

        # One message for every failure, so the form never confirms which emails have accounts.
        if not ok or not user.isActive:
            LoginThrottle.record_failure(email, address)
            logger.warning(f"Failed sign-in for {email or '<blank>'} from {address}")
            raise HTTPException(status_code=401, detail="That email and password do not match an active account.")

        LoginThrottle.record_success(email)

        token = new_session_token()
        now = _now_ms()
        session = UserSession(
            tokenHash=hash_token(token),
            userId=user.id,
            createdAt=now,
            lastUsedAt=now,
            expiresAt=now + settings.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
            userAgent=(user_agent or "")[:200] or None,
        )
        db.add(session)
        user.lastLoginAt = now
        # Housekeeping while we are here: drop this user's sessions that have already expired.
        db.query(UserSession).filter(UserSession.userId == user.id, UserSession.expiresAt <= now).delete(
            synchronize_session=False
        )
        db.commit()
        db.refresh(user)
        logger.info(f"User {user.id} signed in")
        return token, session.expiresAt, user

    @staticmethod
    def logout(db: Session, token: Optional[str]) -> None:
        if not token:
            return
        db.query(UserSession).filter(UserSession.tokenHash == hash_token(token)).delete(synchronize_session=False)
        db.commit()

    @staticmethod
    def change_password(db: Session, user_id: str, current: str, new: str, keep_token: Optional[str]) -> None:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not verify_password(current or "", user.passwordHash):
            raise HTTPException(status_code=400, detail="The current password is not correct.")
        user.passwordHash = hash_password(new)
        # Sign out every other device; keep the one that made the change.
        stale = db.query(UserSession).filter(UserSession.userId == user.id)
        if keep_token:
            stale = stale.filter(UserSession.tokenHash != hash_token(keep_token))
        stale.delete(synchronize_session=False)
        db.commit()

    # ── Users ───────────────────────────────────────────────────────────────────────────
    @staticmethod
    def list_users(db: Session) -> List[User]:
        return db.query(User).order_by(User.createdAt).all()

    @staticmethod
    def get_user(db: Session, user_id: str) -> Optional[User]:
        return db.query(User).filter(User.id == user_id).first()

    @staticmethod
    def _resolve_client(db: Session, role: str, client_id: Optional[str]) -> Optional[str]:
        """An administrator never has a client; a client user always has exactly one."""
        if role == ROLE_ADMIN:
            return None
        if not client_id:
            raise HTTPException(status_code=400, detail="Choose which client this user belongs to.")
        if not db.query(Client.id).filter(Client.id == client_id).first():
            raise HTTPException(status_code=400, detail="The selected client does not exist.")
        return client_id

    @staticmethod
    def _other_active_admins(db: Session, excluding_user_id: str) -> int:
        return (
            db.query(func.count(User.id))
            .filter(User.role == ROLE_ADMIN, User.isActive.is_(True), User.id != excluding_user_id)
            .scalar()
        ) or 0

    @staticmethod
    def create_user(db: Session, payload: UserCreate) -> User:
        first_account = db.query(User.id).first() is None
        if first_account and payload.role != ROLE_ADMIN:
            raise HTTPException(
                status_code=400,
                detail="The first account must be an administrator, otherwise nobody could manage the platform.",
            )
        if db.query(User.id).filter(User.email == payload.email).first():
            raise HTTPException(status_code=409, detail="A user with this email already exists.")

        user = User(
            id=f"USR-{uuid.uuid4().hex[:8].upper()}",
            email=payload.email,
            name=payload.name,
            passwordHash=hash_password(payload.password),
            role=payload.role,
            clientId=AccountService._resolve_client(db, payload.role, payload.clientId),
            isActive=True,
            createdAt=_now_ms(),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        if first_account:
            # From this moment the API requires sign-in; do not wait for the cache to notice.
            reset_login_state()
            logger.info("First administrator created: sign-in is now required.")
        return user

    @staticmethod
    def update_user(db: Session, user_id: str, payload: UserUpdate, acting_user_id: Optional[str]) -> Optional[User]:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return None

        data = payload.model_dump(exclude_unset=True)
        new_role = data.get("role", user.role)
        new_active = data.get("isActive", user.isActive)

        losing_admin = user.role == ROLE_ADMIN and user.isActive and (new_role != ROLE_ADMIN or not new_active)
        if losing_admin:
            if user.id == acting_user_id:
                raise HTTPException(status_code=409, detail="You cannot remove your own administrator access.")
            if AccountService._other_active_admins(db, user.id) == 0:
                raise HTTPException(status_code=409, detail="This is the last active administrator.")

        if "name" in data and data["name"] is not None:
            user.name = data["name"]

        if "role" in data or "clientId" in data:
            user.clientId = AccountService._resolve_client(db, new_role, data.get("clientId", user.clientId))
            user.role = new_role

        sign_out = False
        if "isActive" in data and data["isActive"] is not None:
            sign_out = sign_out or (user.isActive and not data["isActive"])
            user.isActive = data["isActive"]
        if data.get("password"):
            user.passwordHash = hash_password(data["password"])
            sign_out = True
        if sign_out:
            db.query(UserSession).filter(UserSession.userId == user.id).delete(synchronize_session=False)

        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def delete_user(db: Session, user_id: str, acting_user_id: Optional[str]) -> bool:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return False
        if user.id == acting_user_id:
            raise HTTPException(status_code=409, detail="You cannot delete your own account.")
        if user.role == ROLE_ADMIN and user.isActive and AccountService._other_active_admins(db, user.id) == 0:
            raise HTTPException(status_code=409, detail="This is the last active administrator.")
        db.delete(user)
        db.commit()
        return True

    # ── Clients ─────────────────────────────────────────────────────────────────────────
    @staticmethod
    def _counts(db: Session, model) -> dict:
        rows = db.query(model.clientId, func.count()).filter(model.clientId.isnot(None)).group_by(model.clientId).all()
        return {client_id: count for client_id, count in rows}

    @staticmethod
    def list_clients(db: Session) -> List[ClientResponse]:
        counts = {
            "userCount": AccountService._counts(db, User),
            "deviceCount": AccountService._counts(db, Device),
            "mediaCount": AccountService._counts(db, Media),
            "playlistCount": AccountService._counts(db, Playlist),
            "scheduleCount": AccountService._counts(db, Schedule),
        }
        return [
            ClientResponse(
                id=c.id, name=c.name, createdAt=c.createdAt, **{key: table.get(c.id, 0) for key, table in counts.items()}
            )
            for c in db.query(Client).order_by(func.lower(Client.name)).all()
        ]

    @staticmethod
    def _client_response(db: Session, client: Client) -> ClientResponse:
        return next(c for c in AccountService.list_clients(db) if c.id == client.id)

    @staticmethod
    def _ensure_name_free(db: Session, name: str, excluding_id: Optional[str] = None) -> None:
        clash = db.query(Client.id).filter(func.lower(Client.name) == name.lower())
        if excluding_id:
            clash = clash.filter(Client.id != excluding_id)
        if clash.first():
            raise HTTPException(status_code=409, detail="A client with this name already exists.")

    @staticmethod
    def create_client(db: Session, payload: ClientCreate) -> ClientResponse:
        AccountService._ensure_name_free(db, payload.name)
        client = Client(id=f"CL-{uuid.uuid4().hex[:8].upper()}", name=payload.name, createdAt=_now_ms())
        db.add(client)
        db.commit()
        return AccountService._client_response(db, client)

    @staticmethod
    def update_client(db: Session, client_id: str, payload: ClientUpdate) -> Optional[ClientResponse]:
        client = db.query(Client).filter(Client.id == client_id).first()
        if not client:
            return None
        AccountService._ensure_name_free(db, payload.name, excluding_id=client_id)
        client.name = payload.name
        db.commit()
        return AccountService._client_response(db, client)

    @staticmethod
    def delete_client(db: Session, client_id: str) -> bool:
        client = db.query(Client).filter(Client.id == client_id).first()
        if not client:
            return False
        # Refuse rather than orphan: a client's screens would silently become the operator's, and
        # its users would be left with nothing to sign in to.
        in_use = []
        for label, model in (("user", User), ("screen", Device), ("media file", Media), ("playlist", Playlist), ("schedule", Schedule)):
            count = db.query(func.count()).select_from(model).filter(model.clientId == client_id).scalar() or 0
            if count:
                in_use.append(f"{count} {label}{'' if count == 1 else 's'}")
        if in_use:
            raise HTTPException(
                status_code=409,
                detail=f"This client still has {', '.join(in_use)}. Move or delete those first.",
            )
        db.delete(client)
        db.commit()
        return True

    # ── First administrator ─────────────────────────────────────────────────────────────
    @staticmethod
    def bootstrap_admin(db: Session) -> None:
        """
        Creates the first administrator from BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD, and
        only while the users table is empty, so the variables can never reset or resurrect an
        account later.
        """
        email = settings.BOOTSTRAP_ADMIN_EMAIL.lower()
        password = settings.BOOTSTRAP_ADMIN_PASSWORD
        if not email or not password:
            return
        if db.query(User.id).first() is not None:
            return
        if len(password) < PASSWORD_MIN_LENGTH:
            logger.error(f"BOOTSTRAP_ADMIN_PASSWORD is shorter than {PASSWORD_MIN_LENGTH} characters; no administrator was created.")
            return
        AccountService.create_user(db, UserCreate(email=email, name="Administrator", password=password, role=ROLE_ADMIN))
        logger.info(f"Created the first administrator ({email}). Remove BOOTSTRAP_ADMIN_PASSWORD from the environment now.")


__all__ = ["AccountService", "LoginThrottle", "ROLE_ADMIN", "ROLE_CLIENT"]
