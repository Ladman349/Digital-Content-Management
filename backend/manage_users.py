"""
Account administration from a terminal, for the cases the CMS cannot cover: creating the first
administrator without touching the hosting dashboard, and recovering when every administrator has
forgotten their password.

    python manage_users.py create-admin you@example.com "Your Name"
    python manage_users.py reset-password you@example.com
    python manage_users.py list

Passwords are read with getpass, so they never appear on screen, in shell history or in a log.
"""

import getpass
import sys

from app.core.security import PASSWORD_MIN_LENGTH, hash_password
from app.database.account_schema import ensure_account_schema
from app.database.database import SessionLocal, engine
from app.models.user import ROLE_ADMIN, User, UserSession
from app.schemas.account import UserCreate
from app.services.account_service import AccountService


def _ask_password() -> str:
    while True:
        first = getpass.getpass(f"Password (at least {PASSWORD_MIN_LENGTH} characters): ")
        if len(first) < PASSWORD_MIN_LENGTH:
            print("Too short.")
            continue
        if first != getpass.getpass("Again: "):
            print("Those did not match.")
            continue
        return first


def main(argv: list[str]) -> int:
    if not argv or argv[0] not in {"create-admin", "reset-password", "list"}:
        print(__doc__)
        return 2

    ensure_account_schema(engine)
    db = SessionLocal()
    try:
        if argv[0] == "list":
            for u in AccountService.list_users(db):
                state = "active" if u.isActive else "disabled"
                print(f"{u.id}  {u.email:<40} {u.role:<7} {state:<9} {u.clientName or '-'}")
            return 0

        if len(argv) < 2:
            print("An email address is required.")
            return 2
        email = argv[1].strip().lower()

        if argv[0] == "create-admin":
            name = argv[2] if len(argv) > 2 else "Administrator"
            user = AccountService.create_user(db, UserCreate(email=email, name=name, password=_ask_password(), role=ROLE_ADMIN))
            print(f"Created administrator {user.email} ({user.id}). Sign-in is now required.")
            return 0

        user = db.query(User).filter(User.email == email).first()
        if not user:
            print("No user has that email.")
            return 1
        user.passwordHash = hash_password(_ask_password())
        user.isActive = True
        db.query(UserSession).filter(UserSession.userId == user.id).delete(synchronize_session=False)
        db.commit()
        print(f"Password reset for {user.email}; all of their sessions were signed out.")
        return 0
    except Exception as exc:  # noqa: BLE001 - this is an operator-facing tool
        detail = getattr(exc, "detail", None) or str(exc)
        print(f"FAILED: {detail}")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
