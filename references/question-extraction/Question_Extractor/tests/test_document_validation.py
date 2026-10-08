import pytest
from backend.app.services.document_service import DocumentService
from backend.app.core.exceptions import FileValidationException, FileTooLargeException
from backend.app.config import settings


def test_document_extension_validation():
    # Valid extension
    DocumentService.validate_file_metadata("exam_paper.pdf", "application/pdf", 1024)
    DocumentService.validate_file_metadata("scanned_q1.png", "image/png", 1024)
    DocumentService.validate_file_metadata("photo.jpg", "image/jpeg", 1024)

    # Invalid extension
    with pytest.raises(FileValidationException):
        DocumentService.validate_file_metadata("malicious.exe", "application/octet-stream", 1024)

    with pytest.raises(FileValidationException):
        DocumentService.validate_file_metadata("archive.zip", "application/zip", 1024)


def test_document_mime_validation():
    # Unsupported MIME
    with pytest.raises(FileValidationException):
        DocumentService.validate_file_metadata("test.pdf", "text/plain", 1024)


def test_document_size_limit():
    # Exceeding MAX_FILE_SIZE_MB
    oversized = (settings.MAX_FILE_SIZE_MB + 1) * 1024 * 1024
    with pytest.raises(FileTooLargeException):
        DocumentService.validate_file_metadata("large.pdf", "application/pdf", oversized)
