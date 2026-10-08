from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from backend.app.db.database import get_db
from backend.app.models.user import User
from backend.app.models.question import Question
from backend.app.models.answer import Answer
from backend.app.schemas.question import AnswerResponse, AnswerUpdate
from backend.app.api.auth import get_current_user
from backend.app.core.exceptions import ResourceNotFoundException, ForbiddenException

router = APIRouter(prefix="/questions", tags=["Answers"])


@router.get("/{question_id}/answer", response_model=AnswerResponse, summary="Get answer associated with question")
async def get_question_answer(
    question_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Question)
        .where(Question.id == question_id)
        .options(selectinload(Question.answer), selectinload(Question.document))
    )
    q = result.scalar_one_or_none()
    if not q:
        raise ResourceNotFoundException("Question", question_id)
    if q.document.owner_id != current_user.id:
        raise ForbiddenException("You do not have permission to view this question's answer.")

    if not q.answer:
        raise ResourceNotFoundException("Answer for Question", question_id)

    return q.answer


@router.patch("/{question_id}/answer", response_model=AnswerResponse, summary="Update or correct question answer")
async def update_question_answer(
    question_id: str,
    answer_in: AnswerUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Question)
        .where(Question.id == question_id)
        .options(selectinload(Question.answer), selectinload(Question.document))
    )
    q = result.scalar_one_or_none()
    if not q:
        raise ResourceNotFoundException("Question", question_id)
    if q.document.owner_id != current_user.id:
        raise ForbiddenException("You do not have permission to update this answer.")

    if not q.answer:
        # Create new answer record if one didn't exist
        ans = Answer(
            question_id=q.id,
            answer_label=answer_in.answer_label,
            answer_text=answer_in.answer_text,
            confidence=answer_in.confidence or 1.0,
            matching_status=answer_in.matching_status or "matched"
        )
        db.add(ans)
    else:
        ans = q.answer
        update_data = answer_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(ans, field, value)

    await db.commit()
    await db.refresh(ans)
    return ans
