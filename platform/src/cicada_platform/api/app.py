"""FastAPI application factory."""

from __future__ import annotations

from fastapi import FastAPI

from cicada_platform.api.routes import compile as compile_route
from cicada_platform.api.routes import constructor, health, runtime, sandbox
from cicada_platform.core.di.container import Container
from cicada_platform.core.logging.setup import configure_logging
from cicada_platform.core.metrics.registry import MetricsRegistry


def create_app() -> FastAPI:
    configure_logging()
    container = Container()
    container.register_singleton("metrics", MetricsRegistry())

    app = FastAPI(
        title="Cicada Platform API",
        version="0.2.0",
        description="Execute validated graph IR and sandbox jobs",
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
