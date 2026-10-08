import os
import uuid
from typing import Tuple
from fastapi import UploadFile
from backend.app.config import settings
from backend.app.core.exceptions import (
    FileValidationException,
    FileTooLargeException
)

# Magic bytes for MIME verification
MAGIC_BYTES = {
    b"%PDF": "application/pdf",
    b"\x89PNG\r\n\x1a\n": "image/png",
    b"\xff\xd8\xff": "image/jpeg",
}


class DocumentService:
    @staticmethod
    def validate_file_metadata(filename: str, content_type: str, file_size: int):
        # 1. Extension check
        ext = os.path.splitext(filename)[1].lower()
        if ext not in settings.ALLOWED_EXTENSIONS:
            raise FileValidationException(
                f"File extension '{ext}' is not supported. Allowed extensions: {', '.join(settings.ALLOWED_EXTENSIONS)}",
                code="UNSUPPORTED_FILE_EXTENSION"
            )

        # 2. MIME type check
        if content_type not in settings.ALLOWED_MIME_TYPES:
            raise FileValidationException(
                f"MIME type '{content_type}' is not supported.",
                code="UNSUPPORTED_MIME_TYPE"
            )

        # 3. File size limit
        max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
        if file_size > max_bytes:
            raise FileTooLargeException(settings.MAX_FILE_SIZE_MB)

    @staticmethod
    async def save_uploaded_file(file: UploadFile) -> Tuple[str, str, int, str]:
        """
        Validates content using magic bytes and saves to safe UUID storage.
        Returns: (saved_filename, storage_path, file_size, validated_mime)
        """
        # Read header for magic byte verification
        header = await file.read(16)
        if not header:
            raise FileValidationException("Uploaded file is empty.", code="EMPTY_FILE")

        # Validate magic bytes
        validated_mime = None
        for magic, mime in MAGIC_BYTES.items():
            if header.startswith(magic):
                validated_mime = mime
                break

        if not validated_mime:
            # Recheck JPEG variations
            if header[:2] == b"\xff\xd8":
                validated_mime = "image/jpeg"
            else:
                raise FileValidationException(
                    "File content does not match its reported format (corrupted or malformed file).",
                    code="CORRUPT_FILE_HEADER"
                )

        # Read rest of file
        rest = await file.read()
        full_content = header + rest
        file_size = len(full_content)

        # Verify size limit
        max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
        if file_size > max_bytes:
            raise FileTooLargeException(settings.MAX_FILE_SIZE_MB)

        # Generate non-guessable, sanitized storage filename
        safe_ext = os.path.splitext(file.filename or "")[1].lower()
        if not safe_ext or safe_ext not in settings.ALLOWED_EXTENSIONS:
            safe_ext = ".pdf" if validated_mime == "application/pdf" else ".png"

        unique_name = f"{uuid.uuid4()}{safe_ext}"
        storage_path = os.path.join(settings.DOCUMENTS_DIR, unique_name)

        with open(storage_path, "wb") as f:
            f.write(full_content)

        return unique_name, storage_path, file_size, validated_mime
