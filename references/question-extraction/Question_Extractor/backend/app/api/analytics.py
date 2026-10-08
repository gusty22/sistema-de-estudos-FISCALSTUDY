from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from backend.app.db.database import get_db
from backend.app.models.user import User
from backend.app.models.document import Document
from backend.app.models.question import Question
from backend.app.models.answer import Answer
from backend.app.models.review_item import ReviewItem
from backend.app.api.auth import get_current_user

router = APIRouter(prefix="/analytics", tags=["Analytics"])


class DashboardAnalytics(BaseModel):
    total_documents: int
    documents_processing: int
    documents_completed: int
    documents_failed: int
    documents_needs_review: int
    questions_extracted: int
    questions_requiring_review: int
    answers_matched: int
    average_confidence: float


@router.get("/dashboard", response_model=DashboardAnalytics, summary="Get calculated dashboard metrics")
async def get_dashboard_analytics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    user_id = current_user.id

    # 1. Total documents
    tot_docs = await db.scalar(
        select(func.count(Document.id)).where(Document.owner_id == user_id)
    ) or 0

    # 2. Status counts
    proc_docs = await db.scalar(
        select(func.count(Document.id)).where(Document.owner_id == user_id, Document.status == "processing")
    ) or 0

    comp_docs = await db.scalar(
        select(func.count(Document.id)).where(Document.owner_id == user_id, Document.status == "completed")
    ) or 0

    fail_docs = await db.scalar(
        select(func.count(Document.id)).where(Document.owner_id == user_id, Document.status == "failed")
    ) or 0

    review_docs = await db.scalar(
        select(func.count(Document.id)).where(Document.owner_id == user_id, Document.status == "partially_completed")
    ) or 0

    # 3. Question metrics
    q_count = await db.scalar(
        select(func.count(Question.id))
        .join(Document, Document.id == Question.document_id)
        .where(Document.owner_id == user_id)
    ) or 0

    q_review = await db.scalar(
        select(func.count(Question.id))
        .join(Document, Document.id == Question.document_id)
        .where(Document.owner_id == user_id, Question.extraction_status == "needs_review")
    ) or 0

    # 4. Answers matched
    ans_matched = await db.scalar(
        select(func.count(Answer.id))
        .join(Question, Question.id == Answer.question_id)
        .join(Document, Document.id == Question.document_id)
        .where(Document.owner_id == user_id, Answer.matching_status == "matched")
    ) or 0

    # 5. Average confidence
    avg_conf = await db.scalar(
        select(func.avg(Question.confidence))
        .join(Document, Document.id == Question.document_id)
        .where(Document.owner_id == user_id)
    ) or 0.0

    return DashboardAnalytics(
        total_documents=tot_docs,
        documents_processing=proc_docs,
        documents_completed=comp_docs,
        documents_failed=fail_docs,
        documents_needs_review=review_docs,
        questions_extracted=q_count,
        questions_requiring_review=q_review,
        answers_matched=ans_matched,
        average_confidence=round(float(avg_conf), 2)
    )
