from __future__ import annotations

from typing import Any

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from loguru import logger
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException


def _normalize_detail(detail: Any) -> Any:
    if isinstance(detail, (str, dict, list)):
        return detail
    return str(detail)


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": _normalize_detail(exc.detail),
            "request_id": request_id,
        },
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    logger.warning("validation_error", extra={"request_id": request_id, "errors": exc.errors()})
    return JSONResponse(
        status_code=422,
        content={
            "detail": "validation_error",
            "errors": exc.errors(),
            "request_id": request_id,
        },
    )


async def database_exception_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    logger.exception("database_error", extra={"request_id": request_id})
    try:
        import sentry_sdk

        sentry_sdk.capture_exception(exc)
    except Exception:
        pass
    return JSONResponse(
        status_code=500,
        content={
            "detail": "database_error",
            "request_id": request_id,
        },
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    logger.exception("unhandled_exception", extra={"request_id": request_id})
    try:
        import sentry_sdk

        sentry_sdk.capture_exception(exc)
    except Exception:
        pass
    return JSONResponse(
        status_code=500,
        content={
            "detail": "internal_server_error",
            "request_id": request_id,
        },
    )
