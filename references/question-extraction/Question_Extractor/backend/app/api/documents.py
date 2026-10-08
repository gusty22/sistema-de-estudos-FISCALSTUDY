import os
from typing import Optional, List
from fastapi import APIRouter, Depends, UploadFile, File, BackgroundTasks, Query, status
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from backend.app.config import settings
from backend.app.db.database import get_db
from backend.app.models.user import User
from backend.app.models.document import Document
from backend.app.models.document_page import DocumentPage
from backend.app.models.question import Question
from backend.app.models.review_item import ReviewItem
from backend.app.schemas.document import (
    DocumentUploadResponse,
    DocumentStatusResponse,
    DocumentResponse,
    DocumentPageResponse
)
from backend.app.schemas.pagination import PaginatedResponse
from backend.app.api.auth import get_current_user
from backend.app.services.document_service import DocumentService
from backend.app.workers.document_worker import DocumentProcessingWorker
from backend.app.core.exceptions import ResourceNotFoundException, ForbiddenException, AppException

router = APIRouter(prefix="/documents", tags=["Documents"])


async def get_user_document(document_id: str, current_user: User, db: AsyncSession) -> Document:
    result = await db.execute(
        select(Document)
        .where(Document.id == document_id)
        .options(selectinload(Document.pages), selectinload(Document.questions))
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise ResourceNotFoundException("Document", document_id)
    if doc.owner_id != current_user.id:
        raise ForbiddenException("You do not have permission to access this document.")
    return doc


@router.post(
    "",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload examination paper or question bank document"
)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 1. Validate and store file safely
    saved_name, storage_path, file_size, mime = await DocumentService.save_uploaded_file(file)

    # 2. Create database document record
    doc = Document(
        owner_id=current_user.id,
        filename=saved_name,
        original_filename=file.filename or "uploaded_document",
        mime_type=mime,
        file_size=file_size,
        storage_path=storage_path,
        status="queued",
        current_stage="Queued",
        progress=0
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # 3. Schedule asynchronous processing (non-blocking)
    background_tasks.add_task(DocumentProcessingWorker.process_document, doc.id)

    return DocumentUploadResponse(
        document_id=doc.id,
        status="queued",
        message="Document uploaded successfully and queued for extraction."
    )


@router.post(
    "/seed-sample",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Seed sample multi-page exam paper for immediate testing"
)
async def seed_sample_document(
    background_tasks: BackgroundTasks,
    include_answer_key: bool = Query(True, description="Whether to also upload and link the sample answer key"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    import shutil
    import uuid
    from backend.app.models.document_relation import DocumentRelation

    sample_src = "sample_documents/Sample_Physics_Exam_Paper.pdf"
    if not os.path.exists(sample_src):
        raise ResourceNotFoundException("Sample Document", sample_src)

    # Copy exam paper
    dest_name = f"{uuid.uuid4()}.pdf"
    dest_path = os.path.join(settings.DOCUMENTS_DIR, dest_name)
    shutil.copyfile(sample_src, dest_path)
    file_size = os.path.getsize(dest_path)

    doc = Document(
        owner_id=current_user.id,
        filename=dest_name,
        original_filename="Sample_Physics_Exam_Paper.pdf",
        mime_type="application/pdf",
        file_size=file_size,
        storage_path=dest_path,
        status="queued",
        current_stage="Queued",
        progress=0
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Optional: also seed answer key and link
    if include_answer_key:
        ans_src = "sample_documents/Sample_Physics_Answer_Key.pdf"
        if os.path.exists(ans_src):
            ans_dest_name = f"{uuid.uuid4()}.pdf"
            ans_dest_path = os.path.join(settings.DOCUMENTS_DIR, ans_dest_name)
            shutil.copyfile(ans_src, ans_dest_path)
            ans_size = os.path.getsize(ans_dest_path)

            ans_doc = Document(
                owner_id=current_user.id,
                filename=ans_dest_name,
                original_filename="Sample_Physics_Answer_Key.pdf",
                mime_type="application/pdf",
                file_size=ans_size,
                storage_path=ans_dest_path,
                status="queued",
                current_stage="Queued",
                progress=0
            )
            db.add(ans_doc)
            await db.commit()
            await db.refresh(ans_doc)

            # Link answer key to exam paper
            rel = DocumentRelation(
                source_document_id=doc.id,
                related_document_id=ans_doc.id,
                relation_type="answer_key"
            )
            db.add(rel)
            await db.commit()

            # Process answer key first, then exam paper
            background_tasks.add_task(DocumentProcessingWorker.process_document, ans_doc.id)

    background_tasks.add_task(DocumentProcessingWorker.process_document, doc.id)

    return DocumentUploadResponse(
        document_id=doc.id,
        status="queued",
        message="Sample physics examination paper loaded and queued for processing."
    )


@router.get("", response_model=PaginatedResponse[DocumentResponse], summary="List uploaded documents")
async def list_documents(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Document).where(Document.owner_id == current_user.id)

    if status_filter:
        query = query.where(Document.status == status_filter)
    if search:
        query = query.where(Document.original_filename.ilike(f"%{search}%"))

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_res = await db.execute(count_query)
    total = total_res.scalar_one()

    # Pagination
    query = query.order_by(desc(Document.created_at)).offset((page - 1) * page_size).limit(page_size)
    docs_res = await db.execute(query)
    docs = docs_res.scalars().all()

    # Enrich with counts
    items: List[DocumentResponse] = []
    for d in docs:
        q_cnt = await db.scalar(select(func.count(Question.id)).where(Question.document_id == d.id)) or 0
        r_cnt = await db.scalar(
            select(func.count(ReviewItem.id))
            .join(Question, Question.id == ReviewItem.question_id)
            .where(Question.document_id == d.id, ReviewItem.status == "pending")
        ) or 0
        p_cnt = await db.scalar(select(func.count(DocumentPage.id)).where(DocumentPage.document_id == d.id)) or 0

        resp = DocumentResponse(
            id=d.id,
            owner_id=d.owner_id,
            filename=d.filename,
            original_filename=d.original_filename,
            mime_type=d.mime_type,
            file_size=d.file_size,
            status=d.status,
            current_stage=d.current_stage,
            progress=d.progress,
            processing_started_at=d.processing_started_at,
            processing_completed_at=d.processing_completed_at,
            processing_error=d.processing_error,
            created_at=d.created_at,
            questions_count=q_cnt,
            review_items_count=r_cnt,
            pages_count=p_cnt
        )
        items.append(resp)

    return PaginatedResponse[DocumentResponse](
        items=items,
        page=page,
        page_size=page_size,
        total=total
    )


@router.get("/{document_id}", response_model=DocumentResponse, summary="Get document details")
async def get_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    doc = await get_user_document(document_id, current_user, db)
    q_cnt = await db.scalar(select(func.count(Question.id)).where(Question.document_id == doc.id)) or 0
    r_cnt = await db.scalar(
        select(func.count(ReviewItem.id))
        .join(Question, Question.id == ReviewItem.question_id)
        .where(Question.document_id == doc.id, ReviewItem.status == "pending")
    ) or 0
    p_cnt = await db.scalar(select(func.count(DocumentPage.id)).where(DocumentPage.document_id == doc.id)) or 0

    return DocumentResponse(
        id=doc.id,
        owner_id=doc.owner_id,
        filename=doc.filename,
        original_filename=doc.original_filename,
        mime_type=doc.mime_type,
        file_size=doc.file_size,
        status=doc.status,
        current_stage=doc.current_stage,
        progress=doc.progress,
        processing_started_at=doc.processing_started_at,
        processing_completed_at=doc.processing_completed_at,
        processing_error=doc.processing_error,
        created_at=doc.created_at,
        questions_count=q_cnt,
        review_items_count=r_cnt,
        pages_count=p_cnt
    )


@router.get("/{document_id}/status", response_model=DocumentStatusResponse, summary="Poll processing status")
async def get_document_status(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    doc = await get_user_document(document_id, current_user, db)
    return DocumentStatusResponse(
        document_id=doc.id,
        status=doc.status,
        progress=doc.progress,
        current_stage=doc.current_stage,
        error=doc.processing_error
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete document and extracted content")
async def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    doc = await get_user_document(document_id, current_user, db)

    # Remove files
    if os.path.exists(doc.storage_path):
        try:
            os.remove(doc.storage_path)
        except Exception:
            pass

    # Remove pages images folder
    pages_dir = os.path.join(settings.PAGES_DIR, doc.id)
    if os.path.exists(pages_dir):
        import shutil
        try:
            shutil.rmtree(pages_dir)
        except Exception:
            pass

    await db.delete(doc)
    await db.commit()
    return None


@router.get("/{document_id}/pages/{page_num}/image", summary="Get rendered page image for side-by-side document preview")
async def get_page_image(
    document_id: str,
    page_num: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    doc = await get_user_document(document_id, current_user, db)
    img_path = os.path.join(settings.PAGES_DIR, doc.id, f"page_{page_num}.png")

    if not os.path.exists(img_path):
        # If single image file, fallback to storage path
        if doc.mime_type.startswith("image/") and os.path.exists(doc.storage_path):
            return FileResponse(doc.storage_path, media_type=doc.mime_type)
        raise ResourceNotFoundException("Page Image", f"{document_id}/page/{page_num}")

    return FileResponse(img_path, media_type="image/png")


@router.get("/{document_id}/export/json", summary="Export extracted questions and answers as JSON")
async def export_document_json(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    doc = await get_user_document(document_id, current_user, db)

    q_res = await db.execute(
        select(Question)
        .where(Question.document_id == doc.id)
        .options(selectinload(Question.options), selectinload(Question.answer))
        .order_by(Question.start_page, Question.question_number)
    )
    questions = q_res.scalars().all()

    output = {
        "document_id": doc.id,
        "original_filename": doc.original_filename,
        "status": doc.status,
        "total_questions": len(questions),
        "questions": [
            {
                "id": q.id,
                "question_number": q.question_number,
                "question_text": q.question_text,
                "question_type": q.question_type,
                "confidence": q.confidence,
                "extraction_status": q.extraction_status,
                "source_pages": [q.start_page] if q.start_page == q.end_page else [q.start_page, q.end_page],
                "options": [
                    {"label": opt.label, "text": opt.text, "confidence": opt.confidence}
                    for opt in q.options
                ],
                "answer": {
                    "label": q.answer.answer_label if q.answer else None,
                    "text": q.answer.answer_text if q.answer else None,
                    "confidence": q.answer.confidence if q.answer else 0.0,
                    "matching_status": q.answer.matching_status if q.answer else "not_found"
                } if q.answer else None
            }
            for q in questions
        ]
    }
    return JSONResponse(content=output)
