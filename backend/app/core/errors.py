import logging

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class AppError(Exception):
    """A domain error that maps to a JSON response: {"error": {"code", "message"}}."""

    def __init__(
        self, status: int, code: str, message: str, headers: dict[str, str] | None = None
    ) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.headers = headers


def not_found(message: str = "Not found") -> AppError:
    return AppError(404, "not_found", message)


def forbidden(message: str, code: str = "forbidden") -> AppError:
    return AppError(403, code, message)


def bad_request(code: str, message: str) -> AppError:
    return AppError(400, code, message)


def _error_body(code: str, message: str) -> dict[str, dict[str, str]]:
    return {"error": {"code": code, "message": message}}


async def app_error_handler(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, AppError)
    return JSONResponse(
        status_code=exc.status, content=_error_body(exc.code, exc.message), headers=exc.headers
    )


async def validation_error_handler(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    first = exc.errors()[0] if exc.errors() else {}
    field = ".".join(str(part) for part in first.get("loc", []) if part != "body")
    message = first.get("msg", "Invalid request")
    if field:
        message = f"{field}: {message}"
    return JSONResponse(status_code=422, content=_error_body("validation_error", message))


async def http_error_handler(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)
    return JSONResponse(
        status_code=exc.status_code, content=_error_body("http_error", str(exc.detail))
    )


async def unhandled_error_handler(_: Request, exc: Exception) -> JSONResponse:
    """Last line of defence: log the real error, return the standard shape, leak nothing."""
    logger.error("Unhandled error", exc_info=exc)
    return JSONResponse(
        status_code=500,
        content=_error_body(
            "internal_error", "Something went wrong on our side. Please try again."
        ),
    )
