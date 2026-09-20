from sqlalchemy import BigInteger, Column, Integer, String, UniqueConstraint

from app.database.base import Base


class PlayStat(Base):
    """
    Proof of play, kept as one row per screen, media file, playlist and hour.

    Raw events would be millions of rows a year per screen (a ten-second item plays 8,640 times a
    day); an hourly counter answers every question a report asks at a few hundred rows a day. The
    hour is the platform's local hour (``hourStart`` is its epoch-ms start), so grouping by day
    never splits a day across a half-hour offset.

    Deliberately no foreign keys: a report has to outlive the screen, file or playlist it is about,
    which is also why the names and owners at the time of play are copied in.
    """

    __tablename__ = "play_stats"
    __table_args__ = (UniqueConstraint("deviceId", "mediaId", "playlistId", "hourStart", name="uq_play_stats_bucket"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    deviceId = Column(String, nullable=False, index=True)
    mediaId = Column(String, nullable=False, index=True)
    # "" when the player did not know which playlist it was running.
    playlistId = Column(String, nullable=False, default="")
    hourStart = Column(BigInteger, nullable=False, index=True)

    plays = Column(Integer, nullable=False, default=0)
    # Plays that ran to the end of the item rather than being cut short by a playlist change.
    completedPlays = Column(Integer, nullable=False, default=0)
    durationMs = Column(BigInteger, nullable=False, default=0)
    lastPlayedAt = Column(BigInteger, nullable=False, default=0)

    # As they were when the play was received. Used for display once the row they describe is gone,
    # and for ownership only then: while the screen or file exists, its current owner decides.
    deviceName = Column(String, nullable=True)
    mediaName = Column(String, nullable=True)
    mediaType = Column(String, nullable=True)
    playlistName = Column(String, nullable=True)
    deviceClientId = Column(String, nullable=True, index=True)
    mediaClientId = Column(String, nullable=True, index=True)


class PlayBatch(Base):
    """
    Batches already counted. A player that never saw the reply sends the same batch again; without
    this the retry would be counted twice. Pruned after a month, far longer than any retry.
    """

    __tablename__ = "play_batches"

    batchId = Column(String, primary_key=True)
    deviceId = Column(String, nullable=False)
    receivedAt = Column(BigInteger, nullable=False, index=True)
