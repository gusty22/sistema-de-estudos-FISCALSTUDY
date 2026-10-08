import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, Boolean, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.app.db.database import Base


class Question(Base):
    __tablename__ = "questions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    question_number = Column(String(50), nullable=True)
    question_text = Column(Text, nullable=False)
    question_type = Column(String(50), default="unknown", nullable=False)  # MCQ, multiple_select, true_false, fill_blank, short_answer, long_answer, unknown
    confidence = Column(Float, default=0.0, nullable=False, index=True)
    extraction_status = Column(String(50), default="unverified", nullable=False, index=True)  # verified, needs_review, resolved
    start_page = Column(Integer, default=1, nullable=False)
    end_page = Column(Integer, default=1, nullable=False)
    has_image = Column(Boolean, default=False, nullable=False)
    image_pages = Column(JSON, default=list, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    document = relationship("Document", back_populates="questions")
    options = relationship("Option", back_populates="question", cascade="all, delete-orphan", order_by="Option.label")
    answer = relationship("Answer", back_populates="question", uselist=False, cascade="all, delete-orphan")
    review_items = relationship("ReviewItem", back_populates="question", cascade="all, delete-orphan")
