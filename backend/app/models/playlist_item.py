from sqlalchemy import Column, String, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.database.base import Base

class PlaylistItem(Base):
    __tablename__ = "playlist_items"

    id = Column(String, primary_key=True, index=True)
    playlistId = Column(String, ForeignKey("playlists.id", ondelete="CASCADE"), nullable=False)
    # RESTRICT: media still used by a playlist must not be deletable. The service layer turns the
    # resulting integrity error into a 409 rather than silently emptying playlists.
    mediaId = Column(String, ForeignKey("media.id", ondelete="RESTRICT"), nullable=False)
    order = Column(Integer, nullable=False, default=1)
    duration = Column(Integer, nullable=False, default=10)
    transition = Column(String, nullable=True, default="none")

    playlist = relationship("Playlist", back_populates="items")
    # You could add relationship to media if needed, but not strictly required for this CRUD