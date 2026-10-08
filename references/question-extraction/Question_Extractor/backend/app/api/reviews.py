from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from backend.app.db.database import get_db
from backend.app.models.user import User
from backend.app.models.document import Document
from backend.app.models.question import Question
from backend.app.models.answer import Answer
from backend.app.models.review_item import ReviewItem
from backend.app.schemas.review import ReviewItemResponse, ReviewItemUpdate
from backend.app.schemas.question import QuestionResponse, OptionResponse, AnswerResponse
from backend.app.schemas.pagination import PaginatedResponse
from backend.app.api.auth import get_current_user
from backend.app.api.documents import get_user_document
from backend.app.core.exceptions import ResourceNotFoundException, ForbiddenException, ValidationException

router = APIRouter(tags=["Review System"])


def build_question_response(q: Question) -> QuestionResponse:
    return QuestionResponse(
        id=q.id,
        document_id=q.document_id,
        question_number=q.question_number,
        question_text=q.question_text,
        question_type=q.question_type,
        confidence=q.confidence,
        extraction_status=q.extraction_status,
        start_page=q.start_page,
        end_page=q.end_page,
        has_image=q.has_image,
        image_pages=q.image_pages or [],
        options=[
            OptionResponse(id=opt.id, question_id=opt.question_id, label=opt.label, text=opt.text, confidence=opt.confidence)
            for opt in q.options
        ],
        answer=AnswerResponse(
            id=q.answer.id,
            question_id=q.answer.question_id,
            answer_text=q.answer.answer_text,
            answer_label=q.answer.answer_label,
            confidence=q.answer.confidence,
            source_page=q.answer.source_page,
            matching_status=q.answer.matching_status
        ) if q.answer else None,
        created_at=q.created_at,
        updated_at=q.updated_at
    )


@router.get("/documents/{document_id}/review-items", response_model=List[ReviewItemResponse], summary="Get all review items for a document")
async def get_document_review_items(
    document_id: str,
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await get_user_document(document_id, current_user, db)

    query = (
        select(ReviewItem)
        .join(Question, Question.id == ReviewItem.question_id)
        .where(Question.document_id == document_id)
        .options(
            selectinload(ReviewItem.question).selectinload(Question.options),
            selectinload(ReviewItem.question).selectinload(Question.answer)
        )
    )
    if status_filter:
        query = query.where(ReviewItem.status == status_filter)

    query = query.order_by(desc(ReviewItem.confidence))
    result = await db.execute(query)
    items = result.scalars().all()

    response: List[ReviewItemResponse] = []
    for item in items:
        resp = ReviewItemResponse(
            id=item.id,
            question_id=item.question_id,
            issue_type=item.issue_type,
            description=item.description,
            confidence=item.confidence,
            status=item.status,
            reviewer_id=item.reviewer_id,
            reviewed_at=item.reviewed_at,
            notes=item.notes,
            question=build_question_response(item.question) if item.question else None
        )
        response.append(resp)
    return response


@router.get("/reviews/queue", response_model=PaginatedResponse[ReviewItemResponse], summary="Get human review queue across user documents")
async def get_review_queue(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    issue_type: Optional[str] = Query(None, description="Filter: low_confidence, missing_answer, ocr_issue, partial_extraction, uncertain_question_boundary"),
    status_filter: Optional[str] = Query("pending", alias="status"),
    document_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(ReviewItem)
        .join(Question, Question.id == ReviewItem.question_id)
        .join(Document, Document.id == Question.document_id)
        .where(Document.owner_id == current_user.id)
        .options(
            selectinload(ReviewItem.question).selectinload(Question.options),
            selectinload(ReviewItem.question).selectinload(Question.answer)
        )
    )

    if status_filter and status_filter != "all":
        query = query.where(ReviewItem.status == status_filter)
    if issue_type:
        query = query.where(ReviewItem.issue_type == issue_type)
    if document_id:
        query = query.where(Document.id == document_id)

    count_query = select(func.count()).select_from(query.subquery())
    total_res = await db.execute(count_query)
    total = total_res.scalar_one()

    query = query.order_by(ReviewItem.confidence.asc()).offset((page - 1) * page_size).limit(page_size)
    items_res = await db.execute(query)
    review_items = items_res.scalars().all()

    items: List[ReviewItemResponse] = []
    for item in review_items:
        resp = ReviewItemResponse(
            id=item.id,
            question_id=item.question_id,
            issue_type=item.issue_type,
            description=item.description,
            confidence=item.confidence,
            status=item.status,
            reviewer_id=item.reviewer_id,
            reviewed_at=item.reviewed_at,
            notes=item.notes,
            question=build_question_response(item.question) if item.question else None
        )
        items.append(resp)

    return PaginatedResponse[ReviewItemResponse](
        items=items,
        page=page,
        page_size=page_size,
        total=total
    )


@router.patch("/review-items/{review_item_id}", response_model=ReviewItemResponse, summary="Review action: approve, correct, or reject")
async def update_review_item(
    review_item_id: str,
    update_in: ReviewItemUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    valid_statuses = ("approved", "corrected", "rejected", "pending")
    if update_in.status not in valid_statuses:
        raise ValidationException(f"Invalid status '{update_in.status}'. Allowed: {', '.join(valid_statuses)}")

    result = await db.execute(
        select(ReviewItem)
        .where(ReviewItem.id == review_item_id)
        .options(
            selectinload(ReviewItem.question).selectinload(Question.options),
            selectinload(ReviewItem.question).selectinload(Question.answer),
            selectinload(ReviewItem.question).selectinload(Question.document)
        )
    )
    rev_item = result.scalar_one_or_none()
    if not rev_item:
        raise ResourceNotFoundException("Review Item", review_item_id)

    # Authorization
    if rev_item.question.document.owner_id != current_user.id:
        raise ForbiddenException("You do not have permission to review this item.")

    rev_item.status = update_in.status
    rev_item.reviewer_id = current_user.id
    rev_item.reviewed_at = datetime.now(timezone.utc)
    if update_in.notes:
        rev_item.notes = update_in.notes

    # Apply corrections if provided
    q = rev_item.question
    if update_in.corrected_question_text:
        q.question_text = update_in.corrected_question_text

    if update_in.corrected_answer_label or update_in.corrected_answer_text:
        if not q.answer:
            new_ans = Answer(
                question_id=q.id,
                answer_label=update_in.corrected_answer_label,
                answer_text=update_in.corrected_answer_text,
                confidence=1.0,
                matching_status="matched"
            )
            db.add(new_ans)
        else:
            if update_in.corrected_answer_label:
                q.answer.answer_label = update_in.corrected_answer_label
            if update_in.corrected_answer_text:
                q.answer.answer_text = update_in.corrected_answer_text
            q.answer.matching_status = "matched"
            q.answer.confidence = 1.0

    # If approved or corrected, promote question extraction_status to resolved / verified
    if update_in.status in ("approved", "corrected"):
        q.extraction_status = "resolved"
        q.confidence = max(q.confidence, 0.95)

    await db.commit()
    await db.refresh(rev_item)

    return ReviewItemResponse(
        id=rev_item.id,
        question_id=rev_item.question_id,
        issue_type=rev_item.issue_type,
        description=rev_item.description,
        confidence=rev_item.confidence,
        status=rev_item.status,
        reviewer_id=rev_item.reviewer_id,
        reviewed_at=rev_item.reviewed_at,
        notes=rev_item.notes,
        question=build_question_response(q)
    )
