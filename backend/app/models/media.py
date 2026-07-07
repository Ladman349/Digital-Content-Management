from sqlalchemy import Column, String, BigInteger, Integer
from app.database.base import Base

class Media(Base):
    __tablename__ = "media"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)
    category = Column(String, nullable=False)
    thumbnail = Column(String, nullable=False)
    originalFile = Column(String, nullable=False)
    size = Column(BigInteger, nullable=False)
    dimensions = Column(String, nullable=False)
    duration = Column(Integer, nullable=True)
    uploadedAt = Column(BigInteger, nullable=False)
    uploadedBy = Column(String, nullable=False)
    checksum = Column(String, nullable=True)