from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class DocumentUploadResponse(BaseModel):
    document_id: str
    status: str = "queued"
    message: str = "Document uploaded successfully and queued for asynchronous processing."


class DocumentStatusResponse(BaseModel):
    document_id: str
    status: str
    progress: int
    current_stage: str
    error: Optional[str] = None


class DocumentPageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    page_number: int
    ocr_used: bool
    processing_status: str
    image_url: Optional[str] = None


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_id: str
    filename: str
    original_filename: str
    mime_type: str
    file_size: int
    status: str
    current_stage: str
    progress: int
    processing_started_at: Optional[datetime] = None
    processing_completed_at: Optional[datetime] = None
    processing_error: Optional[str] = None
    created_at: datetime
    questions_count: int = 0
    review_items_count: int = 0
    pages_count: int = 0


class DocumentWarning(BaseModel):
    id: str
    question_id: Optional[str] = None
    question_number: Optional[str] = None
    issue_type: str
    description: str
    confidence: float
    status: str
    page: Optional[int] = None
