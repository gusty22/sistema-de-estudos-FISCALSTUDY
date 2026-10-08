from celery import Celery
from backend.app.config import settings

celery_app = Celery(
    "document_intelligence",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour max per doc
)


@celery_app.task(name="process_document_task", bind=True, max_retries=3)
def celery_process_document(self, document_id: str):
    import asyncio
    from backend.app.workers.document_worker import DocumentProcessingWorker
    try:
        asyncio.run(DocumentProcessingWorker.process_document(document_id))
        return {"document_id": document_id, "status": "completed"}
    except Exception as exc:
        # Retry with exponential backoff up to 3 times
        raise self.retry(exc=exc, countdown=2 ** self.request.retries * 5)
