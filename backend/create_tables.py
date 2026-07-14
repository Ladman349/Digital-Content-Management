from app.database.base import Base
from app.database.database import engine
from app.models.media import Media
from app.models.device import Device
from app.models.playlist import Playlist
from app.models.playlist_item import PlaylistItem
from app.models.device_playlist import DevicePlaylist
from app.models.schedule import Schedule
from app.models.schedule_device import ScheduleDevice
from app.models.app_update import AppUpdate

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

print("Tables Created")