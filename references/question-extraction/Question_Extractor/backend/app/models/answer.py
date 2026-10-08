import uuid
from sqlalchemy import Column, String, Float, Integer, Text, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.db.database import Base


class Answer(Base):
    __tablename__ = "answers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    question_id = Column(String(36), ForeignKey("questions.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    answer_text = Column(Text, nullable=True)
    answer_label = Column(String(20), nullable=True)  # e.g., 'A', 'B', 'True'
    confidence = Column(Float, default=0.0, nullable=False)
    source_page = Column(Integer, nullable=True)
    matching_status = Column(String(50), default="not_found", nullable=False)  # matched, uncertain, not_found

    question = relationship("Question", back_populates="answer")
