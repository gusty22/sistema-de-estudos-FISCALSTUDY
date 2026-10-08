import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.db.database import Base


class DocumentRelation(Base):
    __tablename__ = "document_relations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    source_document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    related_document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    relation_type = Column(String(100), default="answer_key", nullable=False)  # answer_key, supplementary_document, related_question_paper
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    source_document = relationship("Document", foreign_keys=[source_document_id], back_populates="source_relations")
    related_document = relationship("Document", foreign_keys=[related_document_id], back_populates="related_relations")
