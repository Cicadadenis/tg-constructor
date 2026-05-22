"""Semantic Navigation Layer — lossless story grouping over LEVEL_0."""

from __future__ import annotations

import copy

import pytest

from cicada_platform.debug.semantic_navigator import SemanticNavigator
from cicada_platform.debug.story_model import StoryPhase, build_story_from_trace, validate_story_lossless
from cicada_platform.runtime.control_plane.graph_control_plane import GraphControlPlane
from cicada_platform.runtime.semantic_firewall import equivalence_signature
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


def test_story_is_lossless_grouping():
    engine = _engine('при старте:\n    ответ "Hi"\n')
    engine.handle_update(UPDATE_START)
    trace = engine.trace
    story = build_story_from_trace(trace)
    validate_story_lossless(trace, story)
    assert sum(len(s.event_seqs) for s in story.segments) == len(trace.events)


def test_no_node_creation_outside_level_0():
    engine = _engine('при старте:\n    ответ "Hi"\n')
    engine.handle_update(UPDATE_START)
    trace = engine.trace
    nav = SemanticNavigator(engine.graph)
    story = nav.get_story(trace)
    recorded = {e.node_id for e in trace.events if e.node_id}
    for seg in story.segments:
        for nid in seg.node_ids:
            assert nid in recorded or any(
                e.detail.get("target") == nid for e in trace.events
            )


def test_story_reconstruction_consistent_with_trace():
    engine = _engine('при старте:\n    ответ "Hi"\n')
    engine.handle_update(UPDATE_START)
    trace = engine.trace
    nav = SemanticNavigator(engine.graph)
    story = nav.get_story(trace)
    kinds_by_seq = {e.seq: e.kind for e in trace.events}
    for seg in story.segments:
        for seq in seg.event_seqs:
            assert seq in kinds_by_seq
            expected_phase = {
                TraceEventKind.EXECUTION_START: StoryPhase.INIT,
                TraceEventKind.EXECUTION_END: StoryPhase.FINALIZE,
                TraceEventKind.SUSPEND: StoryPhase.WAIT,
                TraceEventKind.RESUME: StoryPhase.RESUME,
            }.get(kinds_by_seq[seq])
            if expected_phase:
                assert seg.phase == expected_phase


def test_jump_to_phase_process():
    engine = _engine('при старте:\n    ответ "Hi"\n')
    engine.handle_update(UPDATE_START)
    trace = engine.trace
    nav = SemanticNavigator(engine.graph)
    process_segs = nav.jump_to_phase(trace, "PROCESS")
    assert process_segs
    assert all(s.phase == StoryPhase.PROCESS for s in process_segs)


def test_explain_path_uses_only_level_0():
    engine = _engine('при старте:\n    ответ "Hi"\n')
    engine.handle_update(UPDATE_START)
    trace = engine.trace
    node_id = next(
        e.node_id for e in trace.events if e.kind == TraceEventKind.NODE_ENTER and e.node_id
    )
    nav = SemanticNavigator(engine.graph)
    expl = nav.explain_path(trace, node_id)
    assert expl["node_id"] == node_id
    assert all(e["seq"] for e in expl["events"])


def test_navigation_does_not_mutate_trace():
    engine = _engine('при старте:\n    ответ "Hi"\n')
    engine.handle_update(UPDATE_START)
    trace = engine.trace
    before = copy.deepcopy([e.model_dump() for e in trace.events])
    sig = equivalence_signature(trace)
    nav = SemanticNavigator(engine.graph)
    nav.get_story(trace)
    nav.jump_to_phase(trace, "ROUTE")
    nav.collapse_units(trace)
    nav.navigate_by_intent(trace, "execute")
    assert [e.model_dump() for e in trace.events] == before
    assert equivalence_signature(trace) == sig


def test_ask_flow_has_wait_and_resume_phases():
    dsl = 'при старте:\n    спросить "Name?" → name\n    ответ "Hi"\n'
    engine = _engine(dsl)
    engine.handle_update(UPDATE_START)
    trace = engine.trace
    nav = SemanticNavigator(engine.graph)
    story = nav.get_story(trace)
    phases = {s.phase for s in story.segments}
    assert StoryPhase.WAIT in phases
    engine.handle_update(
        {
            "message": {
                "message_id": 2,
                "chat": {"id": 1, "type": "private"},
                "from": {"id": 1, "first_name": "T"},
                "text": "Ann",
            }
        }
    )
    trace2 = engine.trace
    story2 = nav.get_story(trace2)
    assert StoryPhase.RESUME in {s.phase for s in story2.segments}
