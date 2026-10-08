from typing import List
from fastapi import APIRouter, Depends, BackgroundTasks, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.db.database import get_db
from backend.app.models.user import User
from backend.app.models.document import Document
from backend.app.models.document_relation import DocumentRelation
from backend.app.schemas.relation import DocumentRelationCreate, DocumentRelationResponse
from backend.app.api.auth import get_current_user
from backend.app.api.documents import get_user_document
from backend.app.workers.document_worker import DocumentProcessingWorker
from backend.app.core.exceptions import ResourceNotFoundException, ValidationException

router = APIRouter(prefix="/documents", tags=["Related Documents"])


@router.post(
    "/{document_id}/relations",
    response_model=DocumentRelationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Associate a related document (e.g., separate AnswerKey.pdf)"
)
async def create_document_relation(
    document_id: str,
    relation_in: DocumentRelationCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify ownership of both documents
    src_doc = await get_user_document(document_id, current_user, db)
    rel_doc = await get_user_document(relation_in.related_document_id, current_user, db)

    if src_doc.id == rel_doc.id:
        raise ValidationException("A document cannot be related to itself.")

    # Check for existing duplicate relation
    existing = await db.execute(
        select(DocumentRelation).where(
            DocumentRelation.source_document_id == document_id,
            DocumentRelation.related_document_id == relation_in.related_document_id,
            DocumentRelation.relation_type == relation_in.relation_type
        )
    )
    if existing.scalar_one_or_none():
        raise ValidationException("This relation already exists.")

    relation = DocumentRelation(
        source_document_id=document_id,
        related_document_id=relation_in.related_document_id,
        relation_type=relation_in.relation_type
    )
    db.add(relation)
    await db.commit()
    await db.refresh(relation)

    # If answer key document is linked, re-run processing on the question paper to match answers
    if relation_in.relation_type == "answer_key":
        background_tasks.add_task(DocumentProcessingWorker.process_document, src_doc.id)

    return relation


@router.get(
    "/{document_id}/relations",
    response_model=List[DocumentRelationResponse],
    summary="List all relations for a document"
)
async def list_document_relations(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await get_user_document(document_id, current_user, db)
    result = await db.execute(
        select(DocumentRelation).where(DocumentRelation.source_document_id == document_id)
    )
    return result.scalars().all()


@router.delete(
    "/{document_id}/relations/{relation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a document relation"
)
async def delete_document_relation(
    document_id: str,
    relation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await get_user_document(document_id, current_user, db)
    result = await db.execute(
        select(DocumentRelation).where(
            DocumentRelation.id == relation_id,
            DocumentRelation.source_document_id == document_id
        )
    )
    rel = result.scalar_one_or_none()
    if not rel:
        raise ResourceNotFoundException("Document Relation", relation_id)

    await db.delete(rel)
    await db.commit()
    return None
