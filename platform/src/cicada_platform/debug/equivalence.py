"""Execution equivalence helpers — LEVEL_0 reconstruction checks."""

from __future__ import annotations

from typing import Any, Sequence

from cicada_platform.runtime.semantic_firewall import (
    assert_same_equivalence_class,
    equivalence_signature,
    validate_replay_steps_match_level_0,
)
from cicada_platform.runtime.trace import ExecutionTrace, TraceEvent, TraceEventKind


def reconstruct_events_from_replay_steps(
    steps: Sequence[Any],
    *,
    trace_id: str,
) -> ExecutionTrace:
    """Rebuild LEVEL_0-shaped trace from canonical replay steps (verification only)."""
    rebuilt = ExecutionTrace(trace_id=trace_id)
    rebuilt.events = []
    rebuilt._seq = 0
    for step in steps:
        rebuilt._seq += 1
        rebuilt.events.append(
            TraceEvent(
                kind=TraceEventKind(step.kind),
                seq=step.seq,
                node_id=step.node_id,
                op=step.op,
                detail=dict(step.detail),
            )
        )
    return rebuilt


def assert_replay_equivalent_to_level_0(
    original: ExecutionTrace,
    steps: Sequence[Any],
    *,
    partial: bool = False,
) -> None:
    validate_replay_steps_match_level_0(original, steps, partial=partial)
    if not partial:
        rebuilt = reconstruct_events_from_replay_steps(
            steps, trace_id=original.trace_id
        )
        assert_same_equivalence_class(original, rebuilt)


def level_0_signatures_equal(a: ExecutionTrace, b: ExecutionTrace) -> bool:
    return equivalence_signature(a) == equivalence_signature(b)
