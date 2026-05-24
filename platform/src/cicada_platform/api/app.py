"""FastAPI application factory."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from cicada_platform.api.routes import compile as compile_route
from cicada_platform.api.routes import constructor, health, runtime, sandbox
from cicada_platform.core.di.container import Container
from cicada_platform.core.logging.setup import configure_logging
from cicada_platform.core.metrics.registry import MetricsRegistry
from cicada_platform.startup_integrity import (
    log_startup_integrity_report,
    run_startup_integrity_check,
)


@asynccontextmanager
async def _app_lifespan(app: FastAPI):
    result = run_startup_integrity_check()
    if not result.ok:
        log_startup_integrity_report(result)
        raise RuntimeError(
            f"Startup blocked: {len(result.violations)} integrity violation(s)"
        )
    yield


def create_app() -> FastAPI:
    configure_logging()
    container = Container()
    container.register_singleton("metrics", MetricsRegistry())

    app = FastAPI(
        title="Cicada Platform API",
        version="0.2.0",
        description="Execute validated graph IR and sandbox jobs",
        lifespan=_app_lifespan,
    )
    app.state.container = container

    app.include_router(health.router, tags=["health"])
    app.include_router(runtime.router, prefix="/v1", tags=["runtime"])
    app.include_router(sandbox.router, prefix="/v1", tags=["sandbox"])
    app.include_router(constructor.router, prefix="/v1/constructor", tags=["constructor"])
    # /v1/compile — structured deprecation route.
    # Returns 410 for DSL-shaped bodies and routes IR-shaped bodies to the
    # IR pipeline so honest clients keep working without resurrecting the
    # deleted DSL parser. See routes/compile.py.
    app.include_router(compile_route.router, prefix="/v1", tags=["compile"])

    return app
