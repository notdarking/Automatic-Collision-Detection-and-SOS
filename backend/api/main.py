"""FastAPI application entry point.

Run with:
    uvicorn backend.api.main:app --port 8000 --reload
"""

import logging
import math
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.database.session import create_tables

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown handler (lifespan API)."""
    # Startup
    logger.info("Creating database tables (if not exist)…")
    create_tables()
    logger.info("Database ready.")
    yield
    # Shutdown (nothing to do in dev)


def create_app() -> FastAPI:
    """Factory function that creates and configures the FastAPI app."""
    app = FastAPI(
        title="ACDS Backend — Automated Vehicle Collision Detection & Hospital Dispatch",
        version="1.0.0",
        description="Backend core for the ACDS system. See docs/CONTRACTS.md for API contracts.",
        lifespan=lifespan,
    )

    # ── CORS (allow all origins for dev; restrict in production) ──────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Global error handlers ─────────────────────────────────────────────────
    def _sanitize_json(obj: Any) -> Any:
        if isinstance(obj, float) and not math.isfinite(obj):
            return str(obj)
        if isinstance(obj, Exception):
            return str(obj)
        if isinstance(obj, dict):
            return {k: _sanitize_json(v) for k, v in obj.items()}
        if isinstance(obj, (list, tuple)):
            return [_sanitize_json(v) for v in obj]
        return obj

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content={"detail": _sanitize_json(exc.errors())},
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        logger.error("Unhandled exception: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )

    # ── Health check (no auth required) ───────────────────────────────────────
    @app.get("/health", tags=["meta"])
    def health():
        """Liveness probe. Returns 200 and service status."""
        return {"status": "ok", "service": "acds-backend", "version": "1.0.0"}

    # ── Routers ───────────────────────────────────────────────────────────────
    from backend.api.events import router as events_router
    from backend.api.patients import router as patients_router
    from backend.api.simulate import router as simulate_router

    app.include_router(events_router)
    app.include_router(patients_router)
    app.include_router(simulate_router)

    return app


app = create_app()
