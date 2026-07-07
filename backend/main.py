import os
import uuid
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException, Request, Depends, APIRouter
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.sql import text

from app.core.logging_util import setup_logging, request_id_ctx
from app.core.config import settings
from app.database.database import get_db, SessionLocal
from app.routers.device_router import router as device_router
from app.routers.media_router import router as media_router
from app.routers.playlist_router import router as playlist_router
from app.routers.schedule_router import router as schedule_router
from app.routers.device_playlist_router import router as device_playlist_router

# Setup logging immediately
setup_logging()
logger = logging.getLogger("api")

# Verify startup configuration checks
def verify_startup(db_session: Session):
    logger.info("Running production readiness checks...")
    settings.validate_production()
    
    # 1. Check DB Connection
    try:
        db_session.execute(text("SELECT 1"))
    except Exception as e:
        logger.critical(f"Startup check failed: Database connection failed: {str(e)}")
        raise SystemExit(1)
        
    # 2. Check Storage Connection (if configured)
    from app.core.storage import get_storage_provider
    provider = get_storage_provider()
    try:
        provider.verify_connection()
    except Exception as e:
        logger.critical(f"Startup check failed: Storage connection failed: {str(e)}")
        raise SystemExit(1)
        
    logger.info("All production readiness checks passed.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    db = SessionLocal()
    try:
        verify_startup(db)
    finally:
        db.close()
    yield

app = FastAPI(
    title="Digital Signage API",
    lifespan=lifespan
)

# Request ID Middleware
@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:8]
    token = request_id_ctx.set(request_id)
    try:
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
    finally:
        request_id_ctx.reset(token)

# Global database exception shield
from sqlalchemy.exc import SQLAlchemyError
@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    logger.error(f"SQLAlchemy Database Error: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal database error occurred. Reference ID: " + request_id_ctx.get()}
    )

# Generic exception shield
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled Exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred. Reference ID: " + request_id_ctx.get()}
    )

# CORS Configuration
origins = []
allowed_origins_env = settings.CORS_ALLOWED_ORIGINS
if allowed_origins_env:
    origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]

allowed_origin_regex = None
if settings.APP_ENV == "development":
    # Allow any localhost/127.0.0.1 port in development mode
    allowed_origin_regex = r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$"
elif settings.APP_ENV == "production":
    # Enforce strict origins in production (no regex wildcard allowed)
    allowed_origin_regex = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else [],
    allow_origin_regex=allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Versioned APIs Router
api_v1_router = APIRouter(prefix="/api/v1")
api_v1_router.include_router(device_router)
api_v1_router.include_router(media_router)
api_v1_router.include_router(playlist_router)
api_v1_router.include_router(device_playlist_router)
api_v1_router.include_router(schedule_router)
app.include_router(api_v1_router)

# Legacy root mounts for backward compatibility
app.include_router(device_router)
app.include_router(media_router)
app.include_router(playlist_router)
app.include_router(device_playlist_router)
app.include_router(schedule_router)

MEDIA_FOLDER = "media"
os.makedirs(MEDIA_FOLDER, exist_ok=True)

app.mount(
    "/uploads",
    StaticFiles(directory=MEDIA_FOLDER),
    name="uploads"
)

IMAGE_EXTENSIONS = (
    ".png",
    ".jpg",
    ".jpeg",
    ".webp"
)

VIDEO_EXTENSIONS = (
    ".mp4",
    ".webm",
    ".mov"
)

ALLOWED_EXTENSIONS = (
    IMAGE_EXTENSIONS +
    VIDEO_EXTENSIONS
)


@app.get("/")
def home():
    return {
        "message": "Digital Signage Backend Running"
    }


@app.get("/display", response_class=HTMLResponse)
def display_page():

    return """
<!DOCTYPE html>
<html>

<head>

    <title>Digital Signage</title>

    <style>

        body {
            margin: 0;
            background: black;
            overflow: hidden;
            width: 100vw;
            height: 100vh;
        }

        img,
        video {
            width: 100vw;
            height: 100vh;
            object-fit: contain;
            display: none;
            background: black;
        }

    </style>

</head>

<body>

    <img id="imagePlayer">

    <video
        id="videoPlayer"
        autoplay
        muted
        playsinline>
    </video>

    <script>

        let ads = [];
        let currentIndex = 0;
        let imageTimer = null;

        async function loadAds() {

            try {

                const response =
                    await fetch("/ads");

                const data =
                    await response.json();

                ads = data.ads;

                if (
                    currentIndex >= ads.length
                ) {
                    currentIndex = 0;
                }

            } catch (error) {

                console.error(
                    "Error loading ads:",
                    error
                );

            }
        }

        function playNext() {

            if (ads.length === 0) {
                return;
            }

            const item =
                ads[currentIndex];

            currentIndex =
                (currentIndex + 1)
                % ads.length;

            const image =
                document.getElementById(
                    "imagePlayer"
                );

            const video =
                document.getElementById(
                    "videoPlayer"
                );

            image.style.display = "none";
            video.style.display = "none";

            if (imageTimer) {
                clearTimeout(imageTimer);
            }

            const mediaUrl =
                item.url +
                "?t=" +
                Date.now();

            if (
                item.type === "image"
            ) {

                image.src =
                    mediaUrl;

                image.style.display =
                    "block";

                imageTimer =
                    setTimeout(
                        playNext,
                        item.duration || 10000
                    );

            }
            else if (
                item.type === "video"
            ) {

                video.src =
                    mediaUrl;

                video.style.display =
                    "block";

                video.load();

                video.play()
                    .catch(error => {
                        console.error(error);
                        playNext();
                    });

            }
        }

        document
            .getElementById(
                "videoPlayer"
            )
            .addEventListener(
                "ended",
                playNext
            );

        async function start() {

            await loadAds();

            if (
                ads.length > 0
            ) {
                playNext();
            }

            setInterval(
                loadAds,
                30000
            );
        }

        start();

    </script>

</body>

</html>
    """


@app.post("/upload")
async def upload_media(
    file: UploadFile = File(...)
):

    extension = os.path.splitext(
        file.filename
    )[1].lower()

    if extension not in ALLOWED_EXTENSIONS:

        raise HTTPException(
            status_code=400,
            detail="Unsupported file type"
        )

    original_name = os.path.splitext(
        file.filename
    )[0]

    safe_name = (
        original_name
        .replace(" ", "_")
        .replace("/", "_")
        .replace("\\", "_")
    )

    unique_filename = (
        f"{safe_name}_"
        f"{uuid.uuid4().hex[:8]}"
        f"{extension}"
    )

    file_path = os.path.join(
        MEDIA_FOLDER,
        unique_filename
    )

    with open(
        file_path,
        "wb"
    ) as buffer:

        shutil.copyfileobj(
            file.file,
            buffer
        )

    return {
        "message":
            "Uploaded successfully",
        "original_name":
            file.filename,
        "saved_as":
            unique_filename
    }


@app.delete("/delete/{filename}")
def delete_media(filename: str):

    file_path = os.path.join(
        MEDIA_FOLDER,
        filename
    )

    if not os.path.exists(
        file_path
    ):
        raise HTTPException(
            status_code=404,
            detail="File not found"
        )

    os.remove(file_path)

    return {
        "message":
            "File deleted",
        "file":
            filename
    }


@app.get("/ads")
def get_ads():

    ads = []

    files = sorted(
        os.listdir(
            MEDIA_FOLDER
        )
    )

    for file in files:

        extension = os.path.splitext(
            file
        )[1].lower()

        if extension in IMAGE_EXTENSIONS:

            ads.append({
                "url":
                    f"/uploads/{file}",
                "type":
                    "image",
                "duration":
                    3000
            })

        elif extension in VIDEO_EXTENSIONS:

            ads.append({
                "url":
                    f"/uploads/{file}",
                "type":
                    "video"
            })

    return {
        "ads": ads
    }


@app.get("/current-ad")
def current_ad():

    ads = get_ads()["ads"]

    if len(ads) == 0:

        return {
            "current_ad": None
        }

    return {
        "current_ad":
            ads[0]
    }


@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    db_status = "healthy"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        logger.error(f"Health check failed on database: {str(e)}")
        db_status = "unhealthy"

    storage_status = "healthy"
    from app.core.storage import get_storage_provider
    try:
        get_storage_provider().verify_connection()
    except Exception as e:
        logger.error(f"Health check failed on storage: {str(e)}")
        storage_status = "unhealthy"

    overall_status = "healthy" if db_status == "healthy" and storage_status == "healthy" else "unhealthy"
    
    return {
        "status": overall_status,
        "database": db_status,
        "storage": storage_status,
        "environment": settings.APP_ENV,
        "version": "1.0.0"
    }


@app.get("/ready")
def ready_check():
    return {"status": "ready"}
    