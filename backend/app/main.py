import asyncio
import contextlib
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1 import ws
from app.api.v1.router import api_router
from app.core.config import DEFAULT_JWT_SECRET, Settings, get_settings
from app.core.errors import (
    AppError,
    app_error_handler,
    http_error_handler,
    unhandled_error_handler,
    validation_error_handler,
)
from app.db.session import create_engine, create_session_factory
from app.models import Base
from app.realtime.manager import ConnectionManager
from app.realtime.publisher import Realtime
from app.realtime.tasks import maintenance_loop
from app.seed.seed import seed_if_empty
from app.services.container import ServiceContainer
from app.services.storage import FileStorage


def create_app(settings: Settings | None = None, realtime: Realtime | None = None) -> FastAPI:
    """App factory. `realtime` lets tests inject a recording fake instead of real websockets."""
    settings = settings or get_settings()
    if settings.environment == "production" and settings.jwt_secret == DEFAULT_JWT_SECRET:
        # Fail fast: running production with the public development secret would let anyone mint tokens.
        raise RuntimeError("Set JWT_SECRET to a unique random value when ENVIRONMENT=production.")
    engine = create_engine(settings.database_url)
    session_factory = create_session_factory(engine)
    storage = FileStorage(settings.upload_dir)
    container = ServiceContainer(settings, session_factory, ConnectionManager(), storage, realtime)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        if settings.seed_on_startup:
            await seed_if_empty(session_factory, settings)
        task = asyncio.create_task(maintenance_loop(container))
        try:
            yield
        finally:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task
            await container.presence.shutdown()
            await engine.dispose()

    app = FastAPI(title="Signal Clone API", version="1.0.0", lifespan=lifespan)
    app.state.session_factory = session_factory
    app.state.container = container

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(StarletteHTTPException, http_error_handler)
    app.add_exception_handler(Exception, unhandled_error_handler)

    @app.middleware("http")
    async def security_headers(request: Request, call_next) -> Response:  # type: ignore[no-untyped-def]
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("X-Frame-Options", "DENY")
        if request.url.path.startswith("/api/"):
            response.headers.setdefault("Cache-Control", "no-store")  # responses are per-user
        return response

    app.include_router(api_router)
    app.include_router(ws.router)
    app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

    @app.get("/health", tags=["meta"])
    async def health() -> JSONResponse:
        """Liveness plus a real database round-trip, so a broken DB fails the platform health check."""
        try:
            async with session_factory() as session:
                await session.execute(text("SELECT 1"))
        except Exception:
            return JSONResponse({"status": "degraded", "database": "unreachable"}, status_code=503)
        return JSONResponse({"status": "ok", "database": "ok"})

    return app
