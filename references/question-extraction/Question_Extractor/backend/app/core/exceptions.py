from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
from typing import Optional, Any


class AppException(HTTPException):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: Optional[Any] = None
    ):
        super().__init__(status_code=status_code, detail=message)
        self.code = code
        self.message = message
        self.details = details


class ResourceNotFoundException(AppException):
    def __init__(self, resource: str, identifier: str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            code=f"{resource.upper()}_NOT_FOUND",
            message=f"{resource} with id '{identifier}' was not found."
        )


class UnauthorizedException(AppException):
    def __init__(self, message: str = "Authentication credentials were not provided or are invalid."):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="UNAUTHORIZED",
            message=message
        )


class ForbiddenException(AppException):
    def __init__(self, message: str = "You do not have permission to access this resource."):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            code="FORBIDDEN",
            message=message
        )


class ValidationException(AppException):
    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            code="VALIDATION_ERROR",
            message=message,
            details=details
        )


class FileValidationException(AppException):
    def __init__(self, message: str, code: str = "INVALID_FILE"):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            code=code,
            message=message
        )


class FileTooLargeException(AppException):
    def __init__(self, max_mb: int):
        status_code = getattr(status, "HTTP_413_CONTENT_TOO_LARGE", 413)
        super().__init__(
            status_code=status_code,
            code="FILE_TOO_LARGE",
            message=f"File exceeds maximum allowed size of {max_mb} MB."
        )


async def app_exception_handler(request: Request, exc: AppException):
    content = {
        "error": {
            "code": exc.code,
            "message": exc.message
        }
    }
    if exc.details is not None:
        content["error"]["details"] = exc.details
    return JSONResponse(status_code=exc.status_code, content=content)
