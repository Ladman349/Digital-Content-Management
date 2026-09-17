"""
Password hashing and session tokens, standard library only.

Passwords use scrypt (memory-hard, in ``hashlib``), stored as
``scrypt$<log2 n>$<r>$<p>$<salt b64>$<hash b64>`` so the cost can be raised later without
invalidating existing hashes. Session tokens are opaque random strings; the database holds only
their SHA-256. Nothing here depends on ``SECRET_KEY``, so a deployment still running the default
key cannot have its sessions forged.
"""

import base64
import hashlib
import hmac
import secrets

_SCRYPT_LOG2_N = 14
_SCRYPT_R = 8
_SCRYPT_P = 1
_SCRYPT_DKLEN = 32
_SCRYPT_MAXMEM = 64 * 1024 * 1024

PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def _scrypt(password: str, salt: bytes, log2_n: int, r: int, p: int) -> bytes:
    return hashlib.scrypt(
        password.encode("utf-8"), salt=salt, n=2**log2_n, r=r, p=p, dklen=_SCRYPT_DKLEN, maxmem=_SCRYPT_MAXMEM
    )


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = _scrypt(password, salt, _SCRYPT_LOG2_N, _SCRYPT_R, _SCRYPT_P)
    return f"scrypt${_SCRYPT_LOG2_N}${_SCRYPT_R}${_SCRYPT_P}${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, log2_n, r, p, salt_b64, digest_b64 = stored.split("$")
        if scheme != "scrypt":
            return False
        expected = base64.b64decode(digest_b64)
        actual = _scrypt(password, base64.b64decode(salt_b64), int(log2_n), int(r), int(p))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


# Verified against when the email is unknown, so a missing account costs the same time as a wrong
# password and the login endpoint cannot be used to enumerate who has an account.
_DUMMY_HASH = hash_password(secrets.token_urlsafe(16))


def burn_password_check(password: str) -> None:
    verify_password(password, _DUMMY_HASH)


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
