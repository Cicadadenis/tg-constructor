"""Constructor API — structural Graph IR + external execution bridge."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from cicada_platform.constructor.graph_ir_adapter import GraphIRAdapter
from cicada_platform.core.schemas.ir_graph import IrProgramGraph
from cicada_platform.runtime.graph_engine import GraphExecutionEngine

router = APIRouter()


class GraphIRBody(BaseModel):
    graph: dict = Field(default_factory=dict)


class ExecuteGraphRequest(BaseModel):
    graph: dict
    generated_python: str | None = None
    compile_warnings: list[str] = Field(default_factory=list)
    transpile_trace: list[dict] = Field(default_factory=list)
    event: dict = Field(default_factory=lambda: {"message": {"text": "/start", "chat": {"id": 1}, "from": {"id": 1}}})


@router.post("/graph/validate")
async def validate_graph(body: GraphIRBody) -> dict:
    adapter = GraphIRAdapter(body.graph)
    issues = adapter.validate_structure_only()
    return {"ok": not issues, "issues": issues, "graph": adapter.to_dict()}


@router.post("/graph/execute")
async def execute_graph_external(body: ExecuteGraphRequest) -> dict:
    """
    External execution service — GraphControlPlane runs outside UI.
    Returns LEVEL_0 trace (read-only for clients).
    """
    import cicada_platform.debug  # noqa: F401 — observability bootstrap

    adapter = GraphIRAdapter(body.graph)
    structural = adapter.validate_structure_only()
    if structural:
        raise HTTPException(400, detail={"issues": structural})

    graph = IrProgramGraph.model_validate(body.graph)
    from cicada.adapters.mock_telegram import MockTelegramAdapter

    engine = GraphExecutionEngine(graph, MockTelegramAdapter())
    effects = engine.handle_update(body.event)
    trace_level_0 = engine.trace.to_list()
    payload: dict = {
        "trace_id": engine.trace.trace_id,
        "trace": trace_level_0,
        "effects": [getattr(e, "__dict__", str(e)) for e in effects],
    }
    payload["trace_export"] = engine.export_trace()
    if body.generated_python is not None:
        payload["generated_python"] = body.generated_python
    if body.compile_warnings:
        payload["compile_warnings"] = body.compile_warnings
    if body.transpile_trace:
        payload["transpile_trace"] = body.transpile_trace
    return payload


@router.get("/trace/{trace_id}")
async def get_trace_readonly(trace_id: str) -> dict:
    """Read-only trace fetch for UI subscribers."""
    from cicada_platform.debug.trace_store import get_trace_store

    stored = get_trace_store().get(trace_id)
    if stored is None:
        raise HTTPException(404, detail="trace_id not found")
    return {
        "trace_id": trace_id,
        "layer": "LEVEL_0",
        "events": stored.to_list(),
    }
