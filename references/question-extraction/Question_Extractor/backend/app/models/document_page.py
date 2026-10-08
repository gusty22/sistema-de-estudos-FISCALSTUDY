import uuid
from sqlalchemy import Column, String, Integer, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.db.database import Base


class DocumentPage(Base):
    __tablename__ = "document_pages"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    page_number = Column(Integer, nullable=False)
    extracted_text = Column(Text, nullable=True)
    ocr_used = Column(Boolean, default=False, nullable=False)
    image_path = Column(String(500), nullable=True)
    processing_status = Column(String(50), default="completed", nullable=False)

    document = relationship("Document", back_populates="pages")
