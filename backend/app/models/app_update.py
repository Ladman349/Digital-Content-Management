import uuid
from sqlalchemy import Column, String, Integer, Boolean, Text, BigInteger, DateTime, Uuid, text
from sqlalchemy.sql import func
from app.database.base import Base

class AppUpdate(Base):
    __tablename__ = "app_updates"

    id = Column(
        Uuid, 
        primary_key=True, 
        default=uuid.uuid4, 
        server_default=text("(gen_random_uuid())")
    )
    version_name = Column("version_name", String(30), nullable=False)
    version_code = Column("version_code", Integer, nullable=False, unique=True)
    apk_filename = Column("apk_filename", Text, nullable=False)
    apk_url = Column("apk_url", Text, nullable=False)
    checksum_sha256 = Column("checksum_sha256", String, nullable=False)
    file_size = Column("file_size", BigInteger, nullable=False)
    release_notes = Column("release_notes", Text, nullable=True)
    mandatory = Column("mandatory", Boolean, default=False, server_default="false")
    is_active = Column("is_active", Boolean, default=False, server_default="false")
    created_at = Column(
        "created_at", 
        DateTime(timezone=True), 
        default=func.now(), 
        server_default=func.now()
    )
