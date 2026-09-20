from sqlalchemy import BigInteger, Column, Integer, String, Text

from app.database.base import Base


class AuditEvent(Base):
    """
    One thing somebody did in the CMS: who, what, to which row, when.

    No foreign keys, and the names are copied in: the log has to outlive the user who acted and the
    row they acted on. ``clientId`` is the owner of the row at the time, which is what decides
    whether a client user may read the entry; account and player-release entries carry none and are
    for administrators only.
    """

    __tablename__ = "audit_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    at = Column(BigInteger, nullable=False, index=True)

    # "user" (signed in), "key" (ADMIN_API_KEY) or "open" (before sign-in was switched on).
    actorKind = Column(String, nullable=False)
    actorUserId = Column(String, nullable=True, index=True)
    actorName = Column(String, nullable=False)
    actorRole = Column(String, nullable=True)

    # created, updated, deleted, uploaded, handed_over, signed_in, ...
    action = Column(String, nullable=False)
    # screen, media, playlist, schedule, user, client, release, account
    entityType = Column(String, nullable=False, index=True)
    entityId = Column(String, nullable=True, index=True)
    entityName = Column(String, nullable=True)
    clientId = Column(String, nullable=True, index=True)

    # One readable sentence fragment: "name, status → Published".
    summary = Column(Text, nullable=True)
