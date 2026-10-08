from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from backend.app.db.database import get_db
from backend.app.models.user import User
from backend.app.models.question import Question
from backend.app.models.review_item import ReviewItem
from backend.app.schemas.document import DocumentWarning
from backend.app.api.auth import get_current_user
from backend.app.api.documents import get_user_document

router = APIRouter(prefix="/documents", tags=["Warnings"])


@router.get(
    "/{document_id}/warnings",
    response_model=List[DocumentWarning],
    summary="Get all extraction warnings and potential issues for a document"
)
async def get_document_warnings(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await get_user_document(document_id, current_user, db)

    result = await db.execute(
        select(ReviewItem)
        .join(Question, Question.id == ReviewItem.question_id)
        .where(Question.document_id == document_id)
        .options(selectinload(ReviewItem.question))
    )
    items = result.scalars().all()

    warnings: List[DocumentWarning] = []
    for item in items:
        warnings.append(
            DocumentWarning(
                id=item.id,
                question_id=item.question_id,
                question_number=item.question.question_number if item.question else None,
                issue_type=item.issue_type,
                description=item.description,
                confidence=item.confidence,
                status=item.status,
                page=item.question.start_page if item.question else None
            )
        )
    return warnings
