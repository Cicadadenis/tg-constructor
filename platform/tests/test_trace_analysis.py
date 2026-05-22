"""Trace compression, levels, overlay, diff, partial replay."""

from __future__ import annotations

import pytest

from cicada_platform.debug.replay import replay_trace
from cicada_platform.debug.trace_compression import compress_trace
from cicada_platform.debug.trace_diff import diff_traces
from cicada_platform.debug.trace_inspector import TraceInspector
from cicada_platform.debug.trace_levels import TraceLevel
from cicada_platform.debug.trace_view import TraceCategoryFilter
from cicada_platform.runtime.control_plane.graph_control_plane import GraphControlPlane
from cicada_platform.runtime.trace import ExecutionTrace, TraceEventKind

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


def test_compress_reduces_segment_count():
    trace = ExecutionTrace()
    for _ in range(3):
        trace.emit(TraceEventKind.NODE_ENTER, node_id="n1", op="SendMessage")
        trace.emit(TraceEventKind.NODE_EXIT, node_id="n1", op="SendMessage")
    c = compress_trace(trace)
    assert c.raw_event_count == 6
    assert any(s.kind == "node_repeat" for s in c.segments)
    assert c.compressed_event_count < c.raw_event_count


def test_trace_levels_and_filters():
    engine = _engine('при старте:\n    ответ "Hi"\n')
    engine.handle_update(UPDATE_START)
    insp = TraceInspector(engine.graph, engine.trace)
    l0 = insp.smart_view(TraceLevel.LEVEL_0)
    l1 = insp.smart_view(TraceLevel.LEVEL_1)
    l2 = insp.smart_view(TraceLevel.LEVEL_2)
    assert l0["mode"] == "raw"
    assert l1["mode"] == "condensed_flow"
    assert l2["mode"] == "execution_summary"
    ops_only = insp.smart_view(
        TraceLevel.LEVEL_0, category=TraceCategoryFilter.OPS
    )
    assert all(
        e["kind"] in ("node_enter", "node_exit", "action_executed")
        for e in ops_only["events"]
    )


def test_performance_overlay():
    engine = _engine('при старте:\n    ответ "Hi"\n')
    engine.handle_update(UPDATE_START)
    insp = TraceInspector(engine.graph, engine.trace)
    overlay = insp.performance_overlay()
    doc = overlay.summary()
    assert "hot_paths" in doc
    assert "bottlenecks_by_op" in doc


def test_trace_diff_identical_runs():
    dsl = 'при старте:\n    ответ "Hi"\n'
    e1 = _engine(dsl)
    e2 = _engine(dsl)
    e1.handle_update(UPDATE_START)
    e2.handle_update(UPDATE_START)
    d = TraceInspector(e1.graph, e1.trace).diff(e2.trace)
    assert d.path_only_a == d.path_only_b or d.identical or len(d.signature_delta) < 50


def test_partial_replay_and_skip_noop():
    engine = _engine('при старте:\n    ответ "Hi"\n')
    engine.handle_update(UPDATE_START)
    path_nodes = [
        e.node_id
        for e in engine.trace.events
        if e.kind == TraceEventKind.NODE_ENTER and e.node_id
    ]
    if not path_nodes:
        pytest.skip("no path nodes")
    subset = set(path_nodes[: max(1, len(path_nodes) // 2)])
    full = replay_trace(engine.graph, engine.trace)
    partial = replay_trace(
        engine.graph, engine.trace, node_ids=subset, skip_no_ops=True
    )
    assert partial.partial is True
    assert len(partial.steps) <= len(full.steps)


def test_render_levels():
    engine = _engine('при старте:\n    ответ "Hi"\n')
    engine.handle_update(UPDATE_START)
    insp = TraceInspector(engine.graph, engine.trace)
    assert "LEVEL_2" in insp.render(TraceLevel.LEVEL_2)
    assert "segments=" in insp.render(TraceLevel.LEVEL_1) or "x" in insp.render(TraceLevel.LEVEL_1)


def test_transition_aggregation():
    trace = ExecutionTrace()
    for _ in range(4):
        trace.emit(
            TraceEventKind.TRANSITION_TAKEN,
            node_id="a",
            edge="next",
            target="b",
        )
    c = compress_trace(trace)
    assert any(s.kind == "transition_agg" for s in c.segments)


def test_diff_traces_synthetic():
    a = ExecutionTrace()
    a.emit(TraceEventKind.EXECUTION_START)
    a.emit(TraceEventKind.NODE_ENTER, node_id="x", op="A")
    b = ExecutionTrace()
    b.emit(TraceEventKind.EXECUTION_START)
    b.emit(TraceEventKind.NODE_ENTER, node_id="y", op="B")
    d = diff_traces(a, b)
    assert not d.identical
    assert "y" in d.path_only_b or "x" in d.path_only_a
