import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.app.db.database import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    mime_type = Column(String(100), nullable=False)
    file_size = Column(Integer, nullable=False)
    storage_path = Column(String(500), nullable=False)
    status = Column(String(50), default="queued", index=True, nullable=False)
    current_stage = Column(String(100), default="Queued", nullable=False)
    progress = Column(Integer, default=0, nullable=False)
    processing_started_at = Column(DateTime(timezone=True), nullable=True)
    processing_completed_at = Column(DateTime(timezone=True), nullable=True)
    processing_error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    owner = relationship("User", back_populates="documents")
    pages = relationship("DocumentPage", back_populates="document", cascade="all, delete-orphan", order_by="DocumentPage.page_number")
    questions = relationship("Question", back_populates="document", cascade="all, delete-orphan")
    source_relations = relationship(
        "DocumentRelation",
        foreign_keys="DocumentRelation.source_document_id",
        back_populates="source_document",
        cascade="all, delete-orphan"
    )
    related_relations = relationship(
        "DocumentRelation",
        foreign_keys="DocumentRelation.related_document_id",
        back_populates="related_document",
        cascade="all, delete-orphan"
    )
