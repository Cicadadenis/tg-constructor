"""Graph traversal must fail explicitly on missing/invalid nodes."""

from __future__ import annotations

import pytest

from cicada_platform.core.schemas.ir_graph import (
    EdgeKind,
    IrGraphEdge,
    IrGraphNode,
    IrHandlerEntry,
    IrProgramGraph,
)
from cicada_platform.runtime.control_plane.graph_traversal_errors import GraphTraversalNodeError
from cicada_platform.runtime.trace import TraceEventKind


def _engine_with_graph(graph: IrProgramGraph):
    from cicada.adapters.mock_telegram import MockTelegramAdapter  # type: ignore

    from cicada_platform.runtime.control_plane.graph_control_plane import GraphControlPlane

    program = type(
        "P",
        (),
        {"globals": {}, "handlers": [], "scenarios": {}, "blocks": {}},
    )()
    return GraphControlPlane(graph, program, MockTelegramAdapter())


UPDATE = {
    "message": {
        "message_id": 1,
        "chat": {"id": 1, "type": "private"},
        "from": {"id": 1, "first_name": "T"},
        "text": "/start",
    }
}


@pytest.fixture
def trace_mode_on(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CICADA_EXEC_TRACE_MODE", "1")


def test_missing_target_node_raises_with_path(trace_mode_on: None) -> None:
    graph = IrProgramGraph(
        nodes={
            "start": IrGraphNode(id="start", op="Noop", payload={}),
        },
        edges=[
            IrGraphEdge(id="e1", source="start", target="ghost", kind=EdgeKind.NEXT),
        ],
        handlers=[
            IrHandlerEntry(kind="message", trigger="/start", entry_node="start"),
        ],
    )
    engine = _engine_with_graph(graph)
    with pytest.raises(GraphTraversalNodeError) as exc:
        engine.handle_update(UPDATE)

    err = exc.value
    assert err.node_id == "ghost"
    assert err.node_type is None
    assert err.execution_path == ["start"]
    assert err.reason == "missing_node"
    assert "ghost" in str(err)
    assert "start" in str(err)

    error_events = [
        e for e in engine.trace.events if e.kind == TraceEventKind.ERROR_EVENT
    ]
    assert error_events
    assert error_events[-1].detail.get("execution_path") == ["start"]


def test_invalid_empty_op_raises(trace_mode_on: None) -> None:
    graph = IrProgramGraph(
        nodes={
            "bad": IrGraphNode(id="bad", op="", payload={}),
        },
        handlers=[
            IrHandlerEntry(kind="message", trigger="/start", entry_node="bad"),
        ],
    )
    engine = _engine_with_graph(graph)
    with pytest.raises(GraphTraversalNodeError) as exc:
        engine.handle_update(UPDATE)

    err = exc.value
    assert err.node_id == "bad"
    assert err.node_type == ""
    assert err.reason == "invalid_node"


def test_foreach_missing_loop_body_raises(trace_mode_on: None) -> None:
    graph = IrProgramGraph(
        nodes={
            "loop": IrGraphNode(
                id="loop",
                op="ForEach",
                payload={
                    "op": "ForEach",
                    "payload": {"collection": "[1]", "variable": "x"},
                },
            ),
        },
        handlers=[
            IrHandlerEntry(kind="message", trigger="/start", entry_node="loop"),
        ],
    )
    engine = _engine_with_graph(graph)
    with pytest.raises(GraphTraversalNodeError) as exc:
        engine.handle_update(UPDATE)

    err = exc.value
    assert err.node_id == "loop"
    assert err.node_type == "ForEach"
    assert err.reason == "missing_edge"
