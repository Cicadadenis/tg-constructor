"""Execution Equivalence Contract — formal semantic invariants."""

from __future__ import annotations

import copy

import pytest

from cicada_platform.debug.equivalence import (
    assert_replay_equivalent_to_level_0,
    level_0_signatures_equal,
    reconstruct_events_from_replay_steps,
)
from cicada_platform.debug.performance_overlay import PerformanceOverlay
from cicada_platform.debug.replay import replay_trace
from cicada_platform.debug.replay_integrity import (
    canonical_subset_events,
    path_nodes_from_events,
)
from cicada_platform.debug.trace_compression import compress_trace, decompress_trace
from cicada_platform.debug.trace_diff import diff_traces
from cicada_platform.debug.trace_truth import assert_lossless_roundtrip, traces_equal
from cicada_platform.debug.trace_view import SmartTraceView
from cicada_platform.debug.trace_levels import TraceLevel
from cicada_platform.runtime.control_plane.graph_control_plane import GraphControlPlane
from cicada_platform.runtime.semantic_firewall import (
    SemanticFirewallError,
    equivalence_signature,
    validate_diff_preserves_inputs,
    validate_level_0_integrity,
    validate_overlay_annotation_only,
)
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


def test_level_0_integrity_enforced():
    trace = ExecutionTrace()
    trace.emit(TraceEventKind.EXECUTION_START)
    validate_level_0_integrity(trace)


def test_level_0_rejects_broken_seq():
    trace = ExecutionTrace()
    trace.events.append(
        __import__(
            "cicada_platform.runtime.trace", fromlist=["TraceEvent"]
        ).TraceEvent(kind=TraceEventKind.EXECUTION_START, seq=99)
    )
    with pytest.raises(SemanticFirewallError):
        validate_level_0_integrity(trace)


def test_compress_decompress_equivalence():
    engine = _engine('при старте:\n    ответ "Hi"\n')
    engine.handle_update(UPDATE_START)
    trace = engine.trace
    assert_lossless_roundtrip(trace)
    restored = decompress_trace(compress_trace(trace, verify_lossless=False))
    assert equivalence_signature(trace) == equivalence_signature(restored)
    assert traces_equal(trace, restored)


def test_full_replay_equivalent_to_level_0():
    engine = _engine('при старте:\n    ответ "Hi"\n')
    engine.handle_update(UPDATE_START)
    trace = engine.trace
    result = replay_trace(engine.graph, trace, skip_no_ops=False)
    assert_replay_equivalent_to_level_0(trace, result.steps, partial=False)
    rebuilt = reconstruct_events_from_replay_steps(
        result.steps, trace_id=trace.trace_id
    )
    assert level_0_signatures_equal(trace, rebuilt)


def test_partial_replay_subset_equivalence():
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
    assert_replay_equivalent_to_level_0(trace, result.steps, partial=True)
    assert len(result.steps) == len(subset)


def test_skip_no_ops_preserves_equivalence_class():
    engine = _engine('при старте:\n    ответ "Hi"\n')
    engine.handle_update(UPDATE_START)
    trace = engine.trace
    sig = equivalence_signature(trace)
    full = replay_trace(engine.graph, trace, skip_no_ops=False)
    filtered = replay_trace(engine.graph, trace, skip_no_ops=True)
    assert full.path_nodes == filtered.path_nodes
    assert len(filtered.steps) == len(full.steps)


def test_diff_does_not_alter_equivalence_class():
    engine = _engine('при старте:\n    ответ "Hi"\n')
    engine.handle_update(UPDATE_START)
    t1 = engine.trace
    sig1 = equivalence_signature(t1)
    engine.handle_update(UPDATE_START)
    t2 = engine.trace
    sig2 = equivalence_signature(t2)
    validate_diff_preserves_inputs(t1, t2)
    diff_traces(t1, t2)
    assert equivalence_signature(t1) == sig1
    assert equivalence_signature(t2) == sig2


def test_smart_trace_view_no_semantic_augmentation():
    engine = _engine('при старте:\n    ответ "Hi"\n')
    engine.handle_update(UPDATE_START)
    trace = engine.trace
    before = equivalence_signature(trace)
    for level in (TraceLevel.LEVEL_0, TraceLevel.LEVEL_1, TraceLevel.LEVEL_2):
        SmartTraceView(engine.graph, trace, level=level).build()
    assert equivalence_signature(trace) == before


def test_overlay_annotation_only():
    engine = _engine('при старте:\n    ответ "Hi"\n')
    engine.handle_update(UPDATE_START)
    trace = engine.trace
    overlay = PerformanceOverlay.from_trace(engine.graph, trace)
    validate_overlay_annotation_only(overlay.summary(), trace)
    sig_before = equivalence_signature(trace)
    _ = overlay.summary()
    assert equivalence_signature(trace) == sig_before


def test_intelligence_cannot_redefine_semantics_via_mutation():
    from cicada_platform.core.schemas.ir_graph import IrProgramGraph

    trace = ExecutionTrace()
    trace.emit(TraceEventKind.EXECUTION_START)
    trace.emit(TraceEventKind.NODE_ENTER, node_id="n", op="A")
    original_sig = equivalence_signature(trace)
    snapshot = copy.deepcopy([e.model_dump() for e in trace.events])
    compress_trace(trace, verify_lossless=False)
    SmartTraceView(IrProgramGraph(), trace, level=TraceLevel.LEVEL_1).build()
    diff_traces(trace, trace)
    assert [e.model_dump() for e in trace.events] == snapshot
    assert equivalence_signature(trace) == original_sig
