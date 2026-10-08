import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from backend.app.config import settings
from backend.app.db.database import init_db
from backend.app.core.exceptions import AppException, app_exception_handler
from backend.app.api.auth import router as auth_router
from backend.app.api.documents import router as documents_router
from backend.app.api.questions import router as questions_router
from backend.app.api.answers import router as answers_router
from backend.app.api.reviews import router as reviews_router
from backend.app.api.related_documents import router as relations_router
from backend.app.api.warnings import router as warnings_router
from backend.app.api.analytics import router as analytics_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing database schemas...")
    await init_db()
    logger.info("Service initialized and ready to accept requests.")
    yield


app = FastAPI(
    title="Document Intelligence & Question Extraction Service",
    description="""
A production-grade Document Intelligence and Question Extraction REST API.
Accepts PDF documents and image files (PNG/JPG), performs layout analysis, OCR processing,
multi-format question and option parsing, answer key association, multi-factor confidence scoring,
and human-in-the-loop review queues.
    """,
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
app.add_exception_handler(AppException, app_exception_handler)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Invalid request parameter or payload.",
                "details": exc.errors()
            }
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled server exception: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An internal error occurred while processing the request."
            }
        }
    )


# Health check endpoints
@app.get("/health", tags=["Health"], summary="Service health check")
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION
    }


@app.get("/api/v1/health", tags=["Health"], summary="API v1 health check")
async def api_health_check():
    return {
        "status": "healthy",
        "version": settings.VERSION
    }


# Include API routers under /api/v1
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(documents_router, prefix=settings.API_V1_STR)
app.include_router(questions_router, prefix=settings.API_V1_STR)
app.include_router(answers_router, prefix=settings.API_V1_STR)
app.include_router(reviews_router, prefix=settings.API_V1_STR)
app.include_router(relations_router, prefix=settings.API_V1_STR)
app.include_router(warnings_router, prefix=settings.API_V1_STR)
app.include_router(analytics_router, prefix=settings.API_V1_STR)
