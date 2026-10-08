from datetime import datetime
from pydantic import BaseModel, ConfigDict


class DocumentRelationCreate(BaseModel):
    related_document_id: str
    relation_type: str = "answer_key"  # answer_key, supplementary_document, related_question_paper


class DocumentRelationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    source_document_id: str
    related_document_id: str
    relation_type: str
    created_at: datetime
