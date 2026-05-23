"""Trace Truth Contract — compression, diff, replay invariants."""

from __future__ import annotations

import copy

import pytest

from cicada_platform.debug.replay import replay_trace
from cicada_platform.debug.replay_integrity import (
    canonical_subset_events,
    path_nodes_from_events,
    replay_steps_match_subset,
)
from cicada_platform.debug.trace_compression import compress_trace, decompress_trace
from cicada_platform.debug.trace_diff import diff_traces
from cicada_platform.debug.trace_truth import (
    assert_lossless_roundtrip,
    trace_signatures,
    traces_equal,
)
from cicada_platform.debug.trace_view import SmartTraceView, TraceCategoryFilter
from cicada_platform.debug.trace_levels import TraceLevel
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


def test_compression_roundtrip_lossless():
    trace = ExecutionTrace()
    trace.emit(TraceEventKind.EXECUTION_START, inbound_kind="message")
    for _ in range(3):
        trace.emit(TraceEventKind.NODE_ENTER, node_id="n1", op="SendMessage")
        trace.emit(TraceEventKind.NODE_EXIT, node_id="n1", op="SendMessage")
    trace.emit(TraceEventKind.EXECUTION_END, effect_count=0)
    assert_lossless_roundtrip(trace)
    c = compress_trace(trace, verify_lossless=False)
    restored = decompress_trace(c)
    assert traces_equal(trace, restored)


def test_decompress_equals_compress_identity():
    engine = _engine('при старте:\n    ответ "Hi"\n')
    engine.handle_update(UPDATE_START)
    trace = engine.trace
    assert traces_equal(trace, decompress_trace(compress_trace(trace)))


def test_smart_view_does_not_mutate_trace():
    engine = _engine('при старте:\n    ответ "Hi"\n')
    engine.handle_update(UPDATE_START)
    trace = engine.trace
    before = copy.deepcopy([e.model_dump() for e in trace.events])
    view = SmartTraceView(engine.graph, trace, level=TraceLevel.LEVEL_1)
    view.build()
    SmartTraceView(
        engine.graph, trace, level=TraceLevel.LEVEL_0, category=TraceCategoryFilter.OPS
    ).build()
    after = [e.model_dump() for e in trace.events]
    assert before == after
    assert len(trace.events) == len(before)


def test_diff_invariants():
    a = ExecutionTrace()
    a.emit(TraceEventKind.EXECUTION_START)
    a.emit(TraceEventKind.NODE_ENTER, node_id="x", op="A")
    b = ExecutionTrace()
    b.emit(TraceEventKind.EXECUTION_START)
    b.emit(TraceEventKind.NODE_ENTER, node_id="y", op="B")
    d = diff_traces(a, b)
    assert not d.identical
    assert d.signature_delta
    assert trace_signatures(a) != trace_signatures(b)
    d_same = diff_traces(a, a)
    assert d_same.identical
    assert d_same.event_count_delta == 0


def test_replay_equivalence_full_trace():
    engine = _engine('при старте:\n    ответ "Hi"\n')
    engine.handle_update(UPDATE_START)
    trace = engine.trace
    result = replay_trace(engine.graph, trace, skip_no_ops=False)
    assert replay_steps_match_subset(result.steps, list(trace.events))
    assert len(result.steps) == len(trace.events)


def test_partial_replay_matches_canonical_subset():
    engine = _engine('при старте:\n    ответ "Hi"\n')
    engine.handle_update(UPDATE_START)
    trace = engine.trace
    nodes = {
        e.node_id
        for e in trace.events
        if e.kind == TraceEventKind.NODE_ENTER and e.node_id
    }
    subset_ids = set(list(nodes)[: max(1, len(nodes) // 2)])
    subset = canonical_subset_events(trace, node_ids=subset_ids)
    result = replay_trace(
        engine.graph, trace, node_ids=subset_ids, skip_no_ops=False
    )
    assert result.partial is True
    assert replay_steps_match_subset(result.steps, subset)


def test_skip_no_ops_preserves_replay_state():
    engine = _engine('при старте:\n    ответ "Hi"\n')
    engine.handle_update(UPDATE_START)
    trace = engine.trace
    full = replay_trace(engine.graph, trace, skip_no_ops=False)
    filtered = replay_trace(engine.graph, trace, skip_no_ops=True)
    assert full.path_nodes == filtered.path_nodes
    assert full.edges == filtered.edges
    assert len(filtered.display_steps) <= len(filtered.steps)
    assert len(filtered.steps) == len(full.steps)
    events = list(trace.events)
    assert full.path_nodes == path_nodes_from_events(events)
    if filtered.skipped_no_ops > 0:
        assert len(filtered.display_steps) < len(filtered.steps)
