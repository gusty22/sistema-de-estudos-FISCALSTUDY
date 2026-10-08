from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from backend.app.schemas.question import QuestionResponse


class ReviewItemBase(BaseModel):
    issue_type: str
    description: str
    confidence: float
    status: str = "pending"
    notes: Optional[str] = None


class ReviewItemUpdate(BaseModel):
    status: str  # approved, corrected, rejected
    notes: Optional[str] = None
    corrected_question_text: Optional[str] = None
    corrected_answer_label: Optional[str] = None
    corrected_answer_text: Optional[str] = None


class ReviewItemResponse(ReviewItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    question_id: str
    reviewer_id: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    question: Optional[QuestionResponse] = None
