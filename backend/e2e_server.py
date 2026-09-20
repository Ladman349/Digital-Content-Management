"""
A throwaway backend for the CMS browser tests (frontend/e2e).

Starts the real API against a brand-new SQLite file in a temporary folder, with local file storage
and no accounts, then deletes the folder on exit. It never reads DATABASE_URL or the Supabase keys
from backend/.env: every one of them is overridden here before the app is imported, so the browser
tests cannot touch a real database even if run on a machine that has production credentials.

    python e2e_server.py [port]        # default 8010
"""

import atexit
import os
import shutil
import sys
import tempfile

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8010

workdir = tempfile.mkdtemp(prefix="signage-e2e-")
atexit.register(shutil.rmtree, workdir, ignore_errors=True)

os.environ.update(
    {
        "APP_ENV": "development",
        "DATABASE_URL": "sqlite:///" + os.path.join(workdir, "e2e.db").replace("\\", "/"),
        "SUPABASE_URL": "",
        "SUPABASE_SERVICE_ROLE_KEY": "",
        "MEDIA_CACHE_DIR": os.path.join(workdir, "media_cache"),
        "API_BASE_URL": f"http://127.0.0.1:{PORT}",
        "ADMIN_API_KEY": "",
        "REQUIRE_DEVICE_AUTH": "false",
        "BOOTSTRAP_ADMIN_EMAIL": "",
        "BOOTSTRAP_ADMIN_PASSWORD": "",
    }
)

# Uploads are written relative to the working directory, so that moves too.
sys.path.insert(0, BACKEND_DIR)
os.chdir(workdir)

import uvicorn  # noqa: E402

from app.database.base import Base  # noqa: E402
from app.database.database import engine  # noqa: E402
from main import app  # noqa: E402  (importing it registers every model)

assert engine.url.get_backend_name() == "sqlite", "the e2e server must never run against a real database"
Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")
