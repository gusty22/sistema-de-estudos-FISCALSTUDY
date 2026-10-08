from typing import List, Optional, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class OptionBase(BaseModel):
    label: str
    text: str
    confidence: float = 1.0


class OptionCreate(OptionBase):
    pass


class OptionResponse(OptionBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    question_id: str


class AnswerBase(BaseModel):
    answer_text: Optional[str] = None
    answer_label: Optional[str] = None
    confidence: float = 0.0
    source_page: Optional[int] = None
    matching_status: str = "not_found"  # matched, uncertain, not_found


class AnswerUpdate(BaseModel):
    answer_text: Optional[str] = None
    answer_label: Optional[str] = None
    confidence: Optional[float] = None
    matching_status: Optional[str] = "matched"


class AnswerResponse(AnswerBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    question_id: str


class QuestionBase(BaseModel):
    question_number: Optional[str] = None
    question_text: str
    question_type: str = "unknown"
    confidence: float = 0.0
    extraction_status: str = "unverified"
    start_page: int = 1
    end_page: int = 1
    has_image: bool = False
    image_pages: List[int] = Field(default_factory=list)


class QuestionUpdate(BaseModel):
    question_number: Optional[str] = None
    question_text: Optional[str] = None
    question_type: Optional[str] = None
    confidence: Optional[float] = None
    extraction_status: Optional[str] = None
    start_page: Optional[int] = None
    end_page: Optional[int] = None


class QuestionResponse(QuestionBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    document_id: str
    options: List[OptionResponse] = Field(default_factory=list)
    answer: Optional[AnswerResponse] = None
    created_at: datetime
    updated_at: datetime


class QuestionDetailResponse(QuestionResponse):
    review_items_count: int = 0
