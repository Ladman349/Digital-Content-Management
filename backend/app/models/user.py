import time

from sqlalchemy import BigInteger, Boolean, Column, ForeignKey, String
from sqlalchemy.orm import relationship

from app.database.base import Base
# Imported for its side effect: User.client is declared by name, and SQLAlchemy can only resolve
# "Client" if that class has been registered, whoever happens to import this module first.
from app.models.client import Client  # noqa: F401

ROLE_ADMIN = "admin"
ROLE_CLIENT = "client"
VALID_ROLES = {ROLE_ADMIN, ROLE_CLIENT}


class User(Base):
    """
    Someone who signs in to the CMS.

    An ``admin`` runs the whole platform and has no client. A ``client`` user belongs to exactly one
    client and only ever sees that client's screens and content.
    """

    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    # Stored lower-cased; uniqueness is enforced on that form.
    email = Column(String, nullable=False, unique=True, index=True)
    name = Column(String, nullable=False)
    passwordHash = Column(String, nullable=False)
    role = Column(String, nullable=False, default=ROLE_CLIENT)
    clientId = Column(String, ForeignKey("clients.id"), nullable=True, index=True)
    isActive = Column(Boolean, nullable=False, default=True)
    createdAt = Column(BigInteger, nullable=False, default=lambda: int(time.time() * 1000))
    lastLoginAt = Column(BigInteger, nullable=True)

    client = relationship("Client")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")

    @property
    def clientName(self):
        return self.client.name if self.client else None


class UserSession(Base):
    """
    A signed-in session. The bearer token itself is never stored, only its SHA-256, so a leaked
    database cannot be replayed against the API. Deleting the row signs the session out.
    """

    __tablename__ = "user_sessions"

    tokenHash = Column(String, primary_key=True)
    userId = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    createdAt = Column(BigInteger, nullable=False)
    expiresAt = Column(BigInteger, nullable=False)
    lastUsedAt = Column(BigInteger, nullable=False)
    userAgent = Column(String, nullable=True)

    user = relationship("User", back_populates="sessions")
