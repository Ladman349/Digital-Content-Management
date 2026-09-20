import os
import uuid
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Depends, APIRouter
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.sql import text

from app.core.logging_util import setup_logging, request_id_ctx
from app.core.config import settings
from app.database.database import get_db, SessionLocal, engine
from app.database.account_schema import ensure_account_schema, missing_account_schema
from app.database.report_schema import ensure_report_schema, missing_report_schema
from app.database.audit_schema import ensure_audit_schema, missing_audit_schema
from app.database.health_schema import ensure_health_schema, missing_health_schema
from app.routers.device_router import router as device_router
from app.routers.media_router import router as media_router
from app.routers.playlist_router import router as playlist_router
from app.routers.schedule_router import router as schedule_router
from app.routers.app_update_router import router as app_update_router
from app.routers.account_router import auth_router, user_router, client_router, handover_router
from app.routers.report_router import router as report_router
from app.routers.audit_router import router as audit_router

# Setup logging immediately
setup_logging()
logger = logging.getLogger("api")

# Verify startup configuration checks
def verify_startup(db_session: Session):
    logger.info("Running production readiness checks...")
    try:
        settings.validate_production()
    except Exception as e:
        logger.warning(f"Production configuration warning: {str(e)}")
    
    # 1. Check DB Connection
    try:
        db_session.execute(text("SELECT 1"))
        logger.info("Startup check: Database connection verified.")
    except Exception as e:
        logger.error(f"Startup check: Database connection failed: {str(e)}")
        
    # 2. Check Storage Connection (if configured)
    from app.core.storage import get_storage_provider
    provider = get_storage_provider()
    try:
        provider.verify_connection()
        logger.info("Startup check: Storage connection verified.")
    except Exception as e:
        logger.warning(f"Startup check: Storage connection check notice: {str(e)}")
        
    logger.info("Startup readiness checks completed.")


def prepare_accounts(db_session: Session):
    """
    Brings the accounts schema up to date and creates the first administrator when asked to.

    The schema step is additive and idempotent, so it is a no-op on every start after the first.
    A failure is logged loudly rather than raised: the content tables now carry a clientId column,
    and an API that refuses to start takes every screen dark, which is worse than one that starts
    and reports exactly what is missing.
    """
    try:
        ensure_account_schema(engine)
        missing = missing_account_schema(engine)
        if missing:
            logger.error(f"Accounts schema is incomplete, run `python migrate_accounts.py`. Missing: {', '.join(missing)}")
            return
        logger.info("Startup check: accounts schema verified.")
    except Exception as e:
        logger.error(f"Accounts schema could not be verified, run `python migrate_accounts.py`: {str(e)}")
        return

    try:
        from app.services.account_service import AccountService
        AccountService.bootstrap_admin(db_session)
    except Exception as e:
        logger.error(f"Could not create the first administrator: {str(e)}")

def prepare_reports():
    """Adds the proof-of-play tables. Additive and idempotent; a failure is logged, never fatal."""
    try:
        ensure_report_schema(engine)
        missing = missing_report_schema(engine)
        if missing:
            logger.error(f"Reports schema is incomplete, run `python migrate_reports.py`. Missing: {', '.join(missing)}")
            return
        logger.info("Startup check: reports schema verified.")
    except Exception as e:
        logger.error(f"Reports schema could not be verified, run `python migrate_reports.py`: {str(e)}")


def prepare_health():
    """Adds the screen-health columns. The pre-deploy step has normally done this already."""
    try:
        ensure_health_schema(engine)
        missing = missing_health_schema(engine)
        if missing:
            logger.error(f"Screen-health columns are missing, run `python migrate_health.py`: {', '.join(missing)}")
            return
        logger.info("Startup check: screen-health schema verified.")
    except Exception as e:
        logger.error(f"Screen-health schema could not be verified, run `python migrate_health.py`: {str(e)}")


def prepare_audit():
    """Adds the activity-log table. Additive and idempotent; a failure is logged, never fatal."""
    try:
        ensure_audit_schema(engine)
        if missing_audit_schema(engine):
            logger.error("Activity-log schema is incomplete: audit_events is missing.")
            return
        logger.info("Startup check: activity-log schema verified.")
    except Exception as e:
        logger.error(f"Activity-log schema could not be verified: {str(e)}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = SessionLocal()
    try:
        verify_startup(db)
        prepare_accounts(db)
        prepare_reports()
        prepare_audit()
        prepare_health()
    except Exception as e:
        logger.error(f"Non-fatal error during startup lifespan: {str(e)}")
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
origins = [
    "http://localhost:5173",
    "https://ladman349-digital-content-managemen.vercel.app",
    "https://digital-content-management-two.vercel.app",
    "https://dcm.grovitai.com",
    # The native CMS shells (frontend/android, frontend/ios) serve the bundle from these fixed
    # origins. They are listed explicitly so the apps survive APP_ENV=production, which drops the
    # development-only localhost regex below.
    "https://localhost",
    "capacitor://localhost",
]
allowed_origins_env = settings.CORS_ALLOWED_ORIGINS
if allowed_origins_env:
    for o in allowed_origins_env.split(","):
        stripped = o.strip()
        if stripped and stripped not in origins:
            origins.append(stripped)

allowed_origin_regex = None
if settings.APP_ENV == "development":
    # Allow any localhost/127.0.0.1 port in development mode
    allowed_origin_regex = r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$"
elif settings.APP_ENV == "production":
    # Enforce strict origins in production
    allowed_origin_regex = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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
api_v1_router.include_router(schedule_router)
api_v1_router.include_router(app_update_router)
api_v1_router.include_router(auth_router)
api_v1_router.include_router(user_router)
api_v1_router.include_router(client_router)
api_v1_router.include_router(handover_router)
api_v1_router.include_router(report_router)
api_v1_router.include_router(audit_router)
app.include_router(api_v1_router)

# Root mounts for direct REST APIs
app.include_router(device_router)
app.include_router(media_router)
app.include_router(playlist_router)
app.include_router(schedule_router)
app.include_router(app_update_router)
app.include_router(auth_router)
app.include_router(user_router)
app.include_router(client_router)
app.include_router(handover_router)
app.include_router(report_router)
app.include_router(audit_router)

MEDIA_FOLDER = "media"
os.makedirs(MEDIA_FOLDER, exist_ok=True)

app.mount(
    "/uploads",
    StaticFiles(directory=MEDIA_FOLDER),
    name="uploads"
)


@app.get("/")
def home():
    return {
        "message": "Digital Signage Backend Running",
        "version": "1.0.0",
        "docs": "/docs"
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