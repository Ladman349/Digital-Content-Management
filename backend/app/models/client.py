import time

from sqlalchemy import BigInteger, Column, String

from app.database.base import Base


class Client(Base):
    """
    A customer of the signage operator. Screens, media, playlists and schedules carry a nullable
    ``clientId``; a row with NULL belongs to the operator and is visible to administrators only.
    """

    __tablename__ = "clients"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    createdAt = Column(BigInteger, nullable=False, default=lambda: int(time.time() * 1000))
