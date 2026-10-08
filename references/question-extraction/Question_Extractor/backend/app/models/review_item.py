import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.db.database import Base


class ReviewItem(Base):
    __tablename__ = "review_items"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    question_id = Column(String(36), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    issue_type = Column(String(100), nullable=False)  # low_confidence, missing_answer, ocr_issue, partial_extraction, uncertain_question_boundary, diagram_warning
    description = Column(Text, nullable=False)
    confidence = Column(Float, default=0.0, nullable=False)
    status = Column(String(50), default="pending", index=True, nullable=False)  # pending, approved, corrected, rejected
    reviewer_id = Column(String(36), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)

    question = relationship("Question", back_populates="review_items")
