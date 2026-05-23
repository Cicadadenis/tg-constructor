"""Observability layer — trace export, inspector, replay, hooks."""

from __future__ import annotations

import pytest

from cicada_platform.debug.hooks import HookRegistry, dispatch_trace_event, get_hook_registry
from cicada_platform.debug.replay import replay_trace
from cicada_platform.debug.trace_export import build_trace_export
from cicada_platform.debug.trace_inspector import TraceInspector
from cicada_platform.debug.trace_store import get_trace_store
from cicada_platform.runtime.control_plane.graph_control_plane import GraphControlPlane
from cicada_platform.runtime.trace import ExecutionTrace, TraceEvent, TraceEventKind

HEADER = '# Cicada3301\nбот "TOKEN"\n'
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

    from cicada_platform.compiler.legacy_bridge import parse_dsl
    from cicada_platform.compiler.graph_lowering import lower_program_to_graph

    dsl = HEADER + dsl_body
    program = parse_dsl(dsl)
    _, graph = lower_program_to_graph(program, dsl_source=dsl)
    return GraphControlPlane(graph, program, MockTelegramAdapter())


@pytest.fixture
def trace_env(monkeypatch):
    monkeypatch.setenv("CICADA_EXEC_TRACE_MODE", "1")
    monkeypatch.setenv("CICADA_EXEC_REPLAY_MODE", "1")


def test_export_trace_shape(trace_env):
    engine = _engine('при старте:\n    ответ "Hi"\n')
    engine.handle_update(UPDATE_START)
    doc = engine.export_trace()
    assert doc["trace_id"] == engine.trace.trace_id
    assert "nodes_timeline" in doc
    assert "edges_taken" in doc
    assert "resume_events" in doc
    assert "suspended_states" in doc
    assert "profiler" in doc


def test_trace_store_on_replay_mode(trace_env):
    engine = _engine('при старте:\n    ответ "Hi"\n')
    engine.handle_update(UPDATE_START)
    tid = engine.trace.trace_id
    assert get_trace_store().get(tid) is not None
    doc = engine.export_trace(tid)
    assert doc["trace_id"] == tid


def test_trace_inspector_and_text_render(trace_env):
    engine = _engine('при старте:\n    ответ "Hi"\n')
    engine.handle_update(UPDATE_START)
    insp = TraceInspector(engine.graph, engine.trace)
    assert insp.trace_id == engine.trace.trace_id
    assert insp.overview()["event_count"] > 0
    text = insp.render_text()
    assert "trace_id=" in text


def test_offline_replay_no_side_effects(trace_env):
    engine = _engine('при старте:\n    ответ "Hi"\n')
    engine.handle_update(UPDATE_START)
    trace = engine.trace
    n_effects = len(engine.effects)
    result = replay_trace(engine.graph, trace)
    assert result.side_effects is False
    assert result.deterministic is True
    assert len(result.steps) == len(trace.events)
    assert len(engine.effects) == n_effects


def test_debug_hooks_fire():
    calls: list[str] = []

    class H:
        def on_node_enter(self, event, trace):
            calls.append("enter")

        def on_node_exit(self, event, trace):
            calls.append("exit")

    reg = HookRegistry()
    reg.on_node_enter.append(H().on_node_enter)
    reg.on_node_exit.append(H().on_node_exit)
    trace = ExecutionTrace()
    ev_in = TraceEvent(kind=TraceEventKind.NODE_ENTER, seq=1, node_id="n1")
    ev_out = TraceEvent(kind=TraceEventKind.NODE_EXIT, seq=2, node_id="n1")
    reg.dispatch(ev_in, trace)
    reg.dispatch(ev_out, trace)
    assert calls == ["enter", "exit"]


def test_build_trace_export_profiler():
    trace = ExecutionTrace()
    trace.emit(TraceEventKind.NODE_ENTER, node_id="a", op="test")
    trace.emit(TraceEventKind.NODE_EXIT, node_id="a", op="test")
    from cicada_platform.core.schemas.ir_graph import IrProgramGraph

    graph = IrProgramGraph(nodes={}, edges=[], entry_nodes=[])
    doc = build_trace_export(graph, trace)
    assert doc["profiler"]["node_count"] >= 0
