from typing import Optional, List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_
from sqlalchemy.orm import selectinload
from backend.app.db.database import get_db
from backend.app.models.user import User
from backend.app.models.document import Document
from backend.app.models.question import Question
from backend.app.models.option import Option
from backend.app.models.answer import Answer
from backend.app.models.review_item import ReviewItem
from backend.app.schemas.question import (
    QuestionResponse,
    QuestionDetailResponse,
    QuestionUpdate,
    OptionResponse,
    AnswerResponse
)
from backend.app.schemas.pagination import PaginatedResponse
from backend.app.api.auth import get_current_user
from backend.app.api.documents import get_user_document
from backend.app.core.exceptions import ResourceNotFoundException, ForbiddenException

router = APIRouter(tags=["Questions"])


@router.get(
    "/documents/{document_id}/questions",
    response_model=PaginatedResponse[QuestionResponse],
    summary="List extracted questions for a document with filtering & pagination"
)
async def list_document_questions(
    document_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    question_type: Optional[str] = Query(None, description="Filter by type: MCQ, true_false, fill_blank, short_answer, etc."),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by extraction_status: verified, needs_review, resolved"),
    confidence_min: Optional[float] = Query(None, ge=0.0, le=1.0),
    confidence_max: Optional[float] = Query(None, ge=0.0, le=1.0),
    search: Optional[str] = Query(None, description="Search question text or number"),
    has_answer: Optional[bool] = Query(None, description="Filter by presence of matched answer"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify access to document
    await get_user_document(document_id, current_user, db)

    query = select(Question).where(Question.document_id == document_id)

    if question_type:
        query = query.where(Question.question_type == question_type)
    if status_filter:
        query = query.where(Question.extraction_status == status_filter)
    if confidence_min is not None:
        query = query.where(Question.confidence >= confidence_min)
    if confidence_max is not None:
        query = query.where(Question.confidence <= confidence_max)
    if search:
        query = query.where(
            or_(
                Question.question_text.ilike(f"%{search}%"),
                Question.question_number.ilike(f"%{search}%")
            )
        )

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_res = await db.execute(count_query)
    total = total_res.scalar_one()

    # Fetch paginated items with eager loaded options and answer
    query = (
        query
        .options(selectinload(Question.options), selectinload(Question.answer))
        .order_by(Question.start_page, Question.question_number)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    questions = result.scalars().all()

    items: List[QuestionResponse] = []
    for q in questions:
        if has_answer is not None:
            is_matched = q.answer is not None and q.answer.matching_status == "matched"
            if has_answer != is_matched:
                continue

        resp = QuestionResponse(
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
        items.append(resp)

    return PaginatedResponse[QuestionResponse](
        items=items,
        page=page,
        page_size=page_size,
        total=total
    )


@router.get("/questions/{question_id}", response_model=QuestionDetailResponse, summary="Get single question with full details")
async def get_question(
    question_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Question)
        .where(Question.id == question_id)
        .options(selectinload(Question.options), selectinload(Question.answer), selectinload(Question.document))
    )
    q = result.scalar_one_or_none()
    if not q:
        raise ResourceNotFoundException("Question", question_id)

    # Ownership check
    if q.document.owner_id != current_user.id:
        raise ForbiddenException("You do not have permission to view this question.")

    rev_cnt = await db.scalar(
        select(func.count(ReviewItem.id)).where(ReviewItem.question_id == q.id, ReviewItem.status == "pending")
    ) or 0

    return QuestionDetailResponse(
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
        updated_at=q.updated_at,
        review_items_count=rev_cnt
    )


@router.patch("/questions/{question_id}", response_model=QuestionResponse, summary="Update extracted question fields")
async def update_question(
    question_id: str,
    question_in: QuestionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Question)
        .where(Question.id == question_id)
        .options(selectinload(Question.options), selectinload(Question.answer), selectinload(Question.document))
    )
    q = result.scalar_one_or_none()
    if not q:
        raise ResourceNotFoundException("Question", question_id)
    if q.document.owner_id != current_user.id:
        raise ForbiddenException("You do not have permission to update this question.")

    update_data = question_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(q, field, value)

    await db.commit()
    await db.refresh(q)

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
