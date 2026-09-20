"""
On-demand screenshots of what a screen is showing.

The CMS asks; the screen learns of it in the reply to its next heartbeat, captures its own window
and uploads a small JPEG. One file per screen, overwritten each time, kept beside the media cache
(a volume in production, so it survives a redeploy). Nothing is captured unless somebody asks.
"""

import os
import re
import time
import uuid
from typing import Optional

from fastapi import HTTPException, UploadFile

from app.models.device import Device
from app.services.media_service import MEDIA_CACHE_DIR

SCREENSHOT_DIR = os.path.join(MEDIA_CACHE_DIR, "screenshots")
MAX_BYTES = 2 * 1024 * 1024
# A request the screen has not answered within this long is given up on, so a screen that comes back
# online hours later does not upload a picture nobody is waiting for.
REQUEST_TTL_MS = 10 * 60 * 1000
_JPEG_MAGIC = b"\xff\xd8\xff"


def _now_ms() -> int:
    return int(time.time() * 1000)


def _path(device_id: str) -> str:
    # Ids are server-generated, but a filename is still never built from one unfiltered.
    safe = re.sub(r"[^A-Za-z0-9_-]", "_", device_id)[:80]
    return os.path.join(SCREENSHOT_DIR, f"{safe}.jpg")


class ScreenshotService:

    @staticmethod
    def wanted(device: Device) -> bool:
        asked = device.screenshotRequestedAt
        if not asked or _now_ms() - asked > REQUEST_TTL_MS:
            return False
        return not device.screenshotAt or device.screenshotAt < asked

    @staticmethod
    def request(db, device: Device) -> Device:
        device.screenshotRequestedAt = _now_ms()
        db.commit()
        db.refresh(device)
        return device

    @staticmethod
    def store(db, device: Device, file: UploadFile) -> None:
        data = file.file.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise HTTPException(status_code=413, detail="Screenshot is too large.")
        if not data.startswith(_JPEG_MAGIC):
            raise HTTPException(status_code=400, detail="A screenshot must be a JPEG image.")

        os.makedirs(SCREENSHOT_DIR, exist_ok=True)
        target = _path(device.id)
        # Written beside the target and moved into place, so a reader never sees half a picture.
        temporary = f"{target}.{uuid.uuid4().hex}.tmp"
        try:
            with open(temporary, "wb") as handle:
                handle.write(data)
            os.replace(temporary, target)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)

        device.screenshotAt = _now_ms()
        db.commit()

    @staticmethod
    def path_for(device: Device) -> Optional[str]:
        target = _path(device.id)
        return target if device.screenshotAt and os.path.isfile(target) else None

    @staticmethod
    def forget(device_id: str) -> None:
        try:
            os.unlink(_path(device_id))
        except OSError:
            pass
