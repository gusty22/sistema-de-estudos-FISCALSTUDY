import os
from typing import List
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="allow")

    PROJECT_NAME: str = "Document Intelligence & Question Extraction Service"
    API_V1_STR: str = "/api/v1"
    VERSION: str = "1.0.0"

    # Database
    DATABASE_URL: str = Field(
        default="sqlite+aiosqlite:///./storage/doc_intel.db",
        description="Async SQLAlchemy database URL (PostgreSQL or SQLite)"
    )

    # Redis
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis URL for caching and async task queuing"
    )

    # Security & JWT
    JWT_SECRET: str = Field(
        default="dev-super-secret-jwt-key-change-in-production-1234567890",
        description="Secret key for signing JWT tokens"
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # File Storage & Limits
    STORAGE_DIR: str = "./storage"
    DOCUMENTS_DIR: str = "./storage/documents"
    PAGES_DIR: str = "./storage/pages"
    MAX_FILE_SIZE_MB: int = 25
    ALLOWED_MIME_TYPES: List[str] = [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/jpg"
    ]
    ALLOWED_EXTENSIONS: List[str] = [".pdf", ".png", ".jpg", ".jpeg"]

    # OCR Configuration
    OCR_PROVIDER: str = "tesseract"
    TESSERACT_CMD: str = "tesseract"
    OCR_API_KEY: str = ""

    # Confidence Thresholds
    HIGH_CONFIDENCE_THRESHOLD: float = 0.85
    REVIEW_THRESHOLD: float = 0.60

    # CORS
    CORS_ORIGINS: List[str] = ["*"]


settings = Settings()

# Ensure required storage directories exist
os.makedirs(settings.STORAGE_DIR, exist_ok=True)
os.makedirs(settings.DOCUMENTS_DIR, exist_ok=True)
os.makedirs(settings.PAGES_DIR, exist_ok=True)
