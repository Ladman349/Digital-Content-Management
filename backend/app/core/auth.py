"""
Authentication for the two kinds of caller this API serves.

Both modes are **opt-in**, because switching them on carelessly locks out a live fleet:

* **Admin (CMS) auth** activates only when ``ADMIN_API_KEY`` is set. Until then every route behaves
  exactly as before, so an existing deployment keeps working after upgrading.

* **Device (player) auth** activates only when ``REQUIRE_DEVICE_AUTH`` is true. Enable it *after*
  every screen is running a build that sends its real device token. Older builds sent a hardcoded
  placeholder, and a device that cannot authenticate also cannot download the OTA update that would
  fix it, so turning this on too early strands screens permanently.

See DEPLOYMENT.md, "Securing the API", for the rollout order.
"""

import hmac
import logging

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.database import get_db
from app.models.device import Device

logger = logging.getLogger("api")

_BEARER_PREFIX = "bearer "


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


def require_admin(request: Request) -> None:
    """
    Guards CMS routes. Accepts the key as ``X-Admin-Key`` or ``Authorization: Bearer <key>``.

    A no-op while ADMIN_API_KEY is unset, which keeps development and existing deployments working.
    """
    if not admin_auth_enabled():
        return

    supplied = request.headers.get("x-admin-key") or _bearer_token(request)
    if not supplied or not hmac.compare_digest(supplied, settings.ADMIN_API_KEY):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A valid admin API key is required for this operation.",
            headers={"WWW-Authenticate": "Bearer"},
        )


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

    An admin key is also accepted so the CMS and support tooling can fetch the same assets.
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

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="A valid device token is required.",
        headers={"WWW-Authenticate": "Bearer"},
    )
