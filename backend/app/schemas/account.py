import re
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator

from app.core.security import PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH
from app.models.user import VALID_ROLES

# Deliberately loose: the address is an identifier here, never mailed, so the only job is to catch
# obvious typos without rejecting real addresses.
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _clean_email(value: str) -> str:
    value = (value or "").strip().lower()
    if not _EMAIL.match(value) or len(value) > 254:
        raise ValueError("Enter a valid email address.")
    return value


def _clean_password(value: str) -> str:
    if len(value) < PASSWORD_MIN_LENGTH:
        raise ValueError(f"Use at least {PASSWORD_MIN_LENGTH} characters.")
    if len(value) > PASSWORD_MAX_LENGTH:
        raise ValueError(f"Use at most {PASSWORD_MAX_LENGTH} characters.")
    return value


def _clean_name(value: str) -> str:
    value = (value or "").strip()
    if not value:
        raise ValueError("A name is required.")
    if len(value) > 120:
        raise ValueError("Use at most 120 characters.")
    return value


# ── Sign-in ─────────────────────────────────────────────────────────────────────────────
class AuthStatusResponse(BaseModel):
    # False until the first account exists; the CMS then runs without a sign-in screen.
    loginRequired: bool


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    clientId: Optional[str] = None
    clientName: Optional[str] = None
    isActive: bool
    createdAt: int
    lastLoginAt: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class LoginResponse(BaseModel):
    token: str
    expiresAt: int
    user: UserResponse


class PasswordChangeRequest(BaseModel):
    currentPassword: str
    newPassword: str

    _check_new = field_validator("newPassword")(_clean_password)


# ── Users ───────────────────────────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    email: str
    name: str
    password: str
    role: str = "client"
    clientId: Optional[str] = None

    _check_email = field_validator("email")(_clean_email)
    _check_name = field_validator("name")(_clean_name)
    _check_password = field_validator("password")(_clean_password)

    @field_validator("role")
    @classmethod
    def _check_role(cls, value: str) -> str:
        if value not in VALID_ROLES:
            raise ValueError("Role must be admin or client.")
        return value


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    clientId: Optional[str] = None
    isActive: Optional[bool] = None
    # Setting this resets the password and signs the user out everywhere.
    password: Optional[str] = None

    @field_validator("name")
    @classmethod
    def _check_name(cls, value):
        return _clean_name(value) if value is not None else value

    @field_validator("password")
    @classmethod
    def _check_password(cls, value):
        return _clean_password(value) if value is not None else value

    @field_validator("role")
    @classmethod
    def _check_role(cls, value):
        if value is not None and value not in VALID_ROLES:
            raise ValueError("Role must be admin or client.")
        return value


# ── Clients ─────────────────────────────────────────────────────────────────────────────
class ClientCreate(BaseModel):
    name: str

    _check_name = field_validator("name")(_clean_name)


class ClientUpdate(BaseModel):
    name: str

    _check_name = field_validator("name")(_clean_name)


class ClientResponse(BaseModel):
    id: str
    name: str
    createdAt: int
    userCount: int = 0
    deviceCount: int = 0
    mediaCount: int = 0
    playlistCount: int = 0
    scheduleCount: int = 0
