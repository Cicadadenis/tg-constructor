"""Execution Contract — normative tests for EXECUTION_SPEC.md."""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from cicada_platform.compiler.legacy_bridge import parse_dsl
from cicada_platform.compiler.graph_lowering import lower_program_to_graph
from cicada_platform.runtime.config import is_exec_trace_mode
from cicada_platform.runtime.control_plane.graph_control_plane import GraphControlPlane
from cicada_platform.runtime.trace import TraceEventKind

HEADER = '# Cicada3301\nбот "TOKEN"\n'

CONTROL_PLANE_DIR = (
    Path(__file__).resolve().parents[1]
    / "src"
    / "cicada_platform"
    / "runtime"
    / "control_plane"
)

UPDATE_START = {
    "message": {
        "message_id": 1,
        "chat": {"id": 1, "type": "private"},
        "from": {"id": 1, "first_name": "T"},
        "text": "/start",
    }
}


def _engine(dsl_body: str) -> GraphControlPlane:
    from cicada.adapters.mock_telegram import MockTelegramAdapter  # type: ignore

    dsl = HEADER + dsl_body
    program = parse_dsl(dsl)
    _, graph = lower_program_to_graph(program, dsl_source=dsl)
    return GraphControlPlane(graph, program, MockTelegramAdapter())


def _trace_signature(engine: GraphControlPlane) -> list[tuple[str, str | None]]:
    return [(e.kind.value, e.node_id) for e in engine.trace.events]


@pytest.fixture
def trace_mode_on(monkeypatch):
    monkeypatch.setenv("CICADA_EXEC_TRACE_MODE", "1")


def test_order_stability_same_event_twice(trace_mode_on):
    dsl = 'при старте:\n    запомни x = 1\n    ответ "A"\n    ответ "B"\n'
    engine = _engine(dsl)
    engine.handle_update(UPDATE_START)
    sig1 = _trace_signature(engine)

    engine.handle_update(UPDATE_START)
    sig2 = _trace_signature(engine)

    assert sig1 == sig2
    assert sig1[0][0] == TraceEventKind.EXECUTION_START.value
    assert sig1[-1][0] == TraceEventKind.EXECUTION_END.value


def test_trace_id_unique_per_event(trace_mode_on):
    dsl = 'при старте:\n    ответ "Hi"\n'
    engine = _engine(dsl)
    engine.handle_update(UPDATE_START)
    t1 = engine.trace.trace_id
    engine.handle_update(UPDATE_START)
    t2 = engine.trace.trace_id
    assert t1 != t2


def test_exec_trace_export(trace_mode_on):
    assert is_exec_trace_mode()
    engine = _engine('при старте:\n    ответ "Hi"\n')
    engine.handle_update(UPDATE_START)
    doc = engine.last_execution_trace
    assert doc is not None
    assert doc["trace_id"] == engine.trace.trace_id
    assert doc["event_count"] == len(engine.trace.events)
    assert "resume_events" in doc


def test_resume_correctness_ask_flow(trace_mode_on):
    dsl = 'при старте:\n    спросить "Name?" → name\n    ответ "Hi {name}"\n'
    engine = _engine(dsl)
    engine.handle_update(UPDATE_START)
    kinds1 = [e.kind for e in engine.trace.events]
    assert TraceEventKind.SUSPEND in kinds1

    update2 = {
        "message": {
            "message_id": 2,
            "chat": {"id": 1, "type": "private"},
            "from": {"id": 1, "first_name": "T"},
            "text": "Ann",
        }
    }
    engine.handle_update(update2)
    kinds2 = [e.kind for e in engine.trace.events]
    assert TraceEventKind.RESUME in kinds2
    resume_events = [e for e in engine.trace.events if e.kind == TraceEventKind.RESUME]
    assert resume_events[0].detail.get("mode") in ("graph_node", "pending_statements", "scenario")
    assert any(e.kind == TraceEventKind.ACTION_EXECUTED for e in engine.trace.events)


def test_scenario_isolation_per_chat():
    dsl = """при старте:
    запомни v = 1
    ответ "start"
"""
    from cicada.adapters.mock_telegram import MockTelegramAdapter  # type: ignore

    program = parse_dsl(HEADER + dsl)
    _, graph = lower_program_to_graph(program, dsl_source=HEADER + dsl)
    tg = MockTelegramAdapter()
    engine = GraphControlPlane(graph, program, tg)

    engine.handle_update(
        {
            "message": {
                "message_id": 1,
                "chat": {"id": 100, "type": "private"},
                "from": {"id": 100, "first_name": "A"},
                "text": "/start",
            }
        }
    )
    ctx_a = engine.services.native.session_store._users[100]
    engine.handle_update(
        {
            "message": {
                "message_id": 1,
                "chat": {"id": 200, "type": "private"},
                "from": {"id": 200, "first_name": "B"},
                "text": "/start",
            }
        }
    )
    ctx_b = engine.services.native.session_store._users[200]
    assert ctx_a.vars.get("v") == 1
    assert ctx_b.vars.get("v") == 1
    assert ctx_a is not ctx_b


def test_loop_determinism_foreach(trace_mode_on):
    dsl = """при старте:
    запомни items = [1, 2, 3]
    для x в items:
        ответ "v{x}"
"""
    engine = _engine(dsl)
    engine.handle_update(UPDATE_START)
    executed1 = [e.op for e in engine.trace.events if e.kind == TraceEventKind.ACTION_EXECUTED]

    engine.handle_update(UPDATE_START)
    executed2 = [e.op for e in engine.trace.events if e.kind == TraceEventKind.ACTION_EXECUTED]

    assert executed1 == executed2
    assert len(executed1) >= 3


def test_native_ops_only_via_traversal_gateway():
    """NativeOpRegistry.execute must not be called from router/scenarios directly."""
    offenders: list[str] = []
    for path in CONTROL_PLANE_DIR.glob("*.py"):
        if path.name in ("graph_traversal.py", "graph_control_plane.py", "protocol.py"):
            continue
        text = path.read_text(encoding="utf-8")
        if ".ops.execute" in text or "NativeOpRegistry" in text:
            offenders.append(path.name)
    assert offenders == [], f"direct ops usage in: {offenders}"


def test_execute_node_import_only_from_traversal():
    importers: list[str] = []
    for path in CONTROL_PLANE_DIR.glob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module:
                if node.module.endswith("ops.registry"):
                    for alias in node.names:
                        if alias.name == "execute_node":
                            importers.append(path.name)
    assert importers == ["graph_traversal.py"]


def test_graph_control_plane_api_unchanged():
    import inspect

    from cicada_platform.runtime.graph_engine import GraphExecutionEngine

    sig = inspect.signature(GraphControlPlane.handle_update)
    assert "update" in sig.parameters
    assert sig.return_annotation in (list, "list", inspect._empty)
    assert hasattr(GraphControlPlane, "from_dsl")
    assert hasattr(GraphControlPlane, "effects")
    assert hasattr(GraphControlPlane, "last_execution_trace")
    assert hasattr(GraphControlPlane, "export_trace")
    assert issubclass(GraphExecutionEngine, GraphControlPlane)
