"""
Authentication for the two kinds of caller this API serves.

**People (the CMS and its phone apps)** sign in with an email and password and then send the
session token as ``Authorization: Bearer <token>``. Every CMS route resolves the caller to a
`Principal`, which says whether they are an administrator and, if not, which client they belong to.
Sign-in is **opt-in by existence**: until the first user account is created the API behaves exactly
as it did before accounts existed, so upgrading never locks a running deployment out. Creating the
first administrator (``BOOTSTRAP_ADMIN_EMAIL`` / ``BOOTSTRAP_ADMIN_PASSWORD``, or
``python manage_users.py create-admin``) is what switches enforcement on.

``ADMIN_API_KEY`` is still honoured as a platform-administrator credential for scripts and support
tooling. With a key set and no users, behaviour is unchanged from earlier releases.

**Players (the screens)** authenticate with their device token, and only once
``REQUIRE_DEVICE_AUTH`` is true. Enable it *after* every screen is running a build that sends its
real device token. Older builds sent a hardcoded placeholder, and a device that cannot authenticate
also cannot download the OTA update that would fix it, so turning this on too early strands screens
permanently. Nothing about user accounts changes how players authenticate.

See DEPLOYMENT.md, "Securing the API", for the rollout order.
"""

import hmac
import logging
import threading
import time
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_token
from app.database.database import get_db
from app.models.client import Client
from app.models.device import Device
from app.models.user import ROLE_ADMIN, User, UserSession

logger = logging.getLogger("api")

_BEARER_PREFIX = "bearer "

# Admins may narrow what they see and create to one client, which is how the CMS's client
# switcher works. Ignored for client users, who are always pinned to their own client.
CLIENT_SCOPE_HEADER = "x-client-scope"

_SESSION_TOUCH_INTERVAL_MS = 10 * 60 * 1000


def _bearer_token(request: Request) -> str | None:
    """Extracts a bearer token from the Authorization header, if present."""
    header = request.headers.get("authorization") or ""
    if header.lower().startswith(_BEARER_PREFIX):
        return header[len(_BEARER_PREFIX):].strip() or None
    return None


def admin_auth_enabled() -> bool:
    return bool(settings.ADMIN_API_KEY)


def device_auth_enabled() -> bool:
    return bool(settings.REQUIRE_DEVICE_AUTH)


# ── People ──────────────────────────────────────────────────────────────────────────────
@dataclass(frozen=True)
class Principal:
    """Who is calling a CMS route, and what they are allowed to see."""

    kind: str  # "user" (signed in), "key" (ADMIN_API_KEY) or "open" (no accounts configured yet)
    is_admin: bool
    user_id: str | None = None
    # The client a client-user belongs to. Always None for administrators.
    client_id: str | None = None
    # What list endpoints filter to and what new rows are stamped with. A client user's own client;
    # for an administrator, the client picked in the CMS switcher, or None for "everything".
    scope_client_id: str | None = None

    @property
    def restricted(self) -> bool:
        return not self.is_admin


class _LoginState:
    """
    Caches whether any user account exists. Accounts are never all removed once created (the last
    administrator cannot be deleted), so a True answer is kept for the life of the process; a False
    answer is re-checked after a few seconds so creating the first admin takes effect promptly.
    """

    _enabled = False
    _checked_at = 0.0
    _lock = threading.Lock()
    _RECHECK_SECONDS = 5.0

    @classmethod
    def enabled(cls, db: Session) -> bool:
        if cls._enabled:
            return True
        now = time.monotonic()
        with cls._lock:
            if cls._checked_at and now - cls._checked_at < cls._RECHECK_SECONDS:
                return cls._enabled
        exists = db.query(User.id).first() is not None
        with cls._lock:
            cls._enabled = exists
            cls._checked_at = now
        return exists

    @classmethod
    def reset(cls) -> None:
        with cls._lock:
            cls._enabled = False
            cls._checked_at = 0.0


def login_enabled(db: Session) -> bool:
    """True once at least one user account exists, which is what makes sign-in mandatory."""
    return _LoginState.enabled(db)


def reset_login_state() -> None:
    """Called when the first account is created, and between tests."""
    _LoginState.reset()


def user_for_token(token: str, db: Session) -> User | None:
    """Resolves a session token to its active user, sliding the session's expiry as it is used."""
    session = db.query(UserSession).filter(UserSession.tokenHash == hash_token(token)).first()
    if not session:
        return None

    now = int(time.time() * 1000)
    if session.expiresAt <= now:
        db.delete(session)
        db.commit()
        return None

    user = session.user
    if not user or not user.isActive:
        return None

    if now - session.lastUsedAt > _SESSION_TOUCH_INTERVAL_MS:
        ttl = settings.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
        session.lastUsedAt = now
        if session.expiresAt - now < ttl // 2:
            session.expiresAt = now + ttl
        db.commit()
    return user


def _admin_scope(request: Request, db: Session) -> str | None:
    requested = (request.headers.get(CLIENT_SCOPE_HEADER) or "").strip()
    if not requested:
        return None
    if not db.query(Client.id).filter(Client.id == requested).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The selected client no longer exists.")
    return requested


def get_principal(request: Request, db: Session = Depends(get_db)) -> Principal:
    """
    Guards every CMS route. Accepts, in order: a signed-in session, the ``ADMIN_API_KEY`` (as
    ``X-Admin-Key`` or a bearer token), or nothing at all while no accounts and no key exist.
    """
    bearer = _bearer_token(request)

    if bearer:
        user = user_for_token(bearer, db)
        if user:
            if user.role == ROLE_ADMIN:
                return Principal(kind="user", is_admin=True, user_id=user.id, scope_client_id=_admin_scope(request, db))
            return Principal(
                kind="user", is_admin=False, user_id=user.id, client_id=user.clientId, scope_client_id=user.clientId
            )

    supplied_key = request.headers.get("x-admin-key") or bearer
    if admin_auth_enabled() and supplied_key and hmac.compare_digest(supplied_key, settings.ADMIN_API_KEY):
        return Principal(kind="key", is_admin=True, scope_client_id=_admin_scope(request, db))

    if not admin_auth_enabled() and not login_enabled(db):
        # Nothing has been configured yet: behave as the API did before accounts existed.
        return Principal(kind="open", is_admin=True, scope_client_id=_admin_scope(request, db))

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sign in to continue.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def require_admin(principal: Principal = Depends(get_principal)) -> Principal:
    """Guards routes only the operator may use: player updates, user accounts and clients."""
    if not principal.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only an administrator can do this.")
    return principal


# ── Players ─────────────────────────────────────────────────────────────────────────────
def require_device(device_id: str, request: Request, db: Session = Depends(get_db)) -> Device:
    """
    Guards player routes that act on a specific device, ensuring the caller holds that device's
    token rather than merely knowing its id.

    While REQUIRE_DEVICE_AUTH is false this only resolves the device and returns 404 when unknown,
    which is the behaviour callers already rely on.
    """
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

    if not device_auth_enabled():
        return device

    supplied = _bearer_token(request)
    if not supplied or not device.deviceToken or not hmac.compare_digest(supplied, device.deviceToken):
        logger.warning(f"Rejected unauthenticated request for device {device_id}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A valid device token is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return device


def require_device_body(device_id: str, request: Request, db: Session) -> Device:
    """
    Same check as `require_device` for routes that carry the device id in the body (heartbeat)
    rather than the path, so it cannot be expressed as a path-parameter dependency.
    """
    return require_device(device_id=device_id, request=request, db=db)


def require_any_device(request: Request, db: Session = Depends(get_db)) -> None:
    """
    Guards player routes that are not scoped to one device (media and APK downloads): the caller
    must present a token belonging to *some* registered device.

    An admin key or a signed-in CMS session is also accepted, so the CMS and support tooling can
    fetch the same assets.
    """
    if not device_auth_enabled():
        return

    supplied = _bearer_token(request) or request.headers.get("x-admin-key")
    if supplied:
        if admin_auth_enabled() and hmac.compare_digest(supplied, settings.ADMIN_API_KEY):
            return
        # Tokens are opaque random hex, so an indexed equality lookup is sufficient here.
        if db.query(Device).filter(Device.deviceToken == supplied).first():
            return
        if user_for_token(supplied, db):
            return

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="A valid device token is required.",
        headers={"WWW-Authenticate": "Bearer"},
    )
