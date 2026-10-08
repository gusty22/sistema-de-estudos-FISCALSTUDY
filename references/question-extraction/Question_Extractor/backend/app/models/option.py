import uuid
from sqlalchemy import Column, String, Float, Text, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.db.database import Base


class Option(Base):
    __tablename__ = "options"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    question_id = Column(String(36), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    label = Column(String(20), nullable=False)  # e.g., 'A', 'B', '1', 'i'
    text = Column(Text, nullable=False)
    confidence = Column(Float, default=1.0, nullable=False)

    question = relationship("Question", back_populates="options")
