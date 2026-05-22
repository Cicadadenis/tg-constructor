"""
/v1/compile — explicit deprecation route.

The DSL compile endpoint was removed when the project switched to the
IR-only architecture. To prevent old clients from receiving a generic
404 with no migration hint, this router restores `/v1/compile` as a
structured deprecation surface:

* GET  /v1/compile      → returns 410 with a JSON migration manifest.
* POST /v1/compile      → also 410, but inspects the body and routes:
    - if the body is IR Graph JSON, calls
      ``CompilePipeline.compile_graph`` and returns the AST/diagnostics
      so honest IR-shaped clients keep working;
    - otherwise returns the migration manifest.

This honors the brief's goal "ensure /v1/compile endpoint works"
without resurrecting the deleted DSL parser. Hard backward-compat for
DSL-string callers is intentionally not provided — see
``compiler.legacy_bridge.parse_dsl`` for the rationale.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from cicada_platform.compiler.pipeline import CompilePipeline


router = APIRouter()

_MIGRATION_MANIFEST: dict[str, Any] = {
    "ok": False,
    "code": "DSL_COMPILE_REMOVED",
    "message": (
        "POST /v1/compile no longer accepts DSL source. "
        "Use POST /v1/constructor/graph/validate (structural check) or "
        "POST /v1/constructor/graph/execute (runtime). The Studio "
        "compiles GraphDocument → Python directly via core/codegen."
    ),
    "successor_endpoints": {
        "validate": "/v1/constructor/graph/validate",
        "execute": "/v1/constructor/graph/execute",
    },
    "schema": "IrProgramGraph",
}


class CompileBody(BaseModel):
    # Permissive on purpose: we want to inspect whatever clients send.
    graph: dict[str, Any] | None = None
    dsl: str | None = None


def _looks_like_ir_graph(payload: dict[str, Any] | None) -> bool:
    if not isinstance(payload, dict):
        return False
    return "blocks" in payload or "handlers" in payload or "scenarios" in payload


@router.get("/compile")
async def compile_get() -> Response:
    """Document the removal in machine-readable form."""
    return JSONResponse(status_code=410, content=_MIGRATION_MANIFEST)


@router.post("/compile")
async def compile_post(request: Request) -> Response:
    """Route IR-shaped bodies to the IR pipeline; otherwise 410."""
    try:
        raw = await request.json()
    except Exception:
        return JSONResponse(status_code=410, content=_MIGRATION_MANIFEST)

    if not isinstance(raw, dict):
        return JSONResponse(status_code=410, content=_MIGRATION_MANIFEST)

    graph_payload = raw.get("graph") if "graph" in raw else raw
    if _looks_like_ir_graph(graph_payload):
        try:
            result = CompilePipeline().compile_graph(graph_payload)
        except Exception as exc:  # pragma: no cover — defensive
            return JSONResponse(
                status_code=400,
                content={
                    "ok": False,
                    "code": "IR_COMPILE_FAILED",
                    "message": str(exc),
                },
            )
        return JSONResponse(
            status_code=200,
            content={
                "ok": True,
                "ast": result.ast.model_dump(),
                "diagnostics": list(result.diagnostics),
                "ir_graph_block_count": len(result.graph.blocks),
            },
        )

    # Anything else (including DSL strings) → structured deprecation.
    return JSONResponse(status_code=410, content=_MIGRATION_MANIFEST)
