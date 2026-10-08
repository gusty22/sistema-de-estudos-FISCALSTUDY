#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "Applying Alembic database migrations..."
/app/venv/bin/alembic upgrade head

echo "Starting FastAPI Uvicorn server on port 8001..."
/app/venv/bin/uvicorn backend.app.main:app --host 127.0.0.1 --port 8001 &
UVICORN_PID=$!

echo "Starting Celery worker..."
/app/venv/bin/celery -A backend.app.workers.celery_app.celery_app worker --loglevel=info --concurrency=2 &
CELERY_PID=$!

echo "Backend services started (Uvicorn PID: $UVICORN_PID, Celery PID: $CELERY_PID)."

# Wait for both processes
wait $UVICORN_PID $CELERY_PID
