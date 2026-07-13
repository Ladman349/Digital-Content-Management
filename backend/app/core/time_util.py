import datetime
from datetime import timezone, timedelta
import sys

# Indian Standard Time (IST) offset is UTC+5:30
IST_OFFSET = timezone(timedelta(hours=5, minutes=30))

try:
    if sys.version_info >= (3, 9):
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
        try:
            IST = ZoneInfo("Asia/Kolkata")
        except ZoneInfoNotFoundError:
            IST = IST_OFFSET
    else:
        IST = IST_OFFSET
except ImportError:
    IST = IST_OFFSET

def now_ist() -> datetime.datetime:
    """
    Returns the current datetime in Indian Standard Time (IST).
    """
    return datetime.datetime.now(IST)

def today_ist() -> datetime.date:
    """
    Returns the current date in Indian Standard Time (IST).
    """
    return now_ist().date()

def time_ist() -> datetime.time:
    """
    Returns the current time in Indian Standard Time (IST).
    """
    return now_ist().time()
