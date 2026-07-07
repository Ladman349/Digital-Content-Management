from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
import shutil
import os
import uuid
from app.routers.device_router import router as device_router
from app.routers.media_router import router as media_router
from app.routers.playlist_router import router as playlist_router
from app.routers.schedule_router import router as schedule_router
from app.routers.device_playlist_router import (
    router as device_playlist_router
)

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Digital Signage API"
)

allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]

# In development, a common pattern is to allow any localhost port. 
# This handles Vite automatically assigning 5174, 5175, etc.
# In production, ALLOWED_ORIGIN_REGEX should be explicitly cleared or set to a strict pattern,
# or relied entirely on ALLOWED_ORIGINS.
allowed_origin_regex = os.getenv(
    "ALLOWED_ORIGIN_REGEX", 
    r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$"
)

# Pass None to Starlette if regex is empty to avoid matching everything if improperly configured
if not allowed_origin_regex.strip():
    allowed_origin_regex = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else [],
    allow_origin_regex=allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
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
    