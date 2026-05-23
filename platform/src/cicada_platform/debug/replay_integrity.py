"""Replay integrity helpers — canonical subset vs presentation filters."""

from __future__ import annotations

from typing import Collection

from cicada_platform.debug.trace_truth import trace_signatures
from cicada_platform.runtime.trace import ExecutionTrace, TraceEvent, TraceEventKind


def canonical_subset_events(
    trace: ExecutionTrace,
    *,
    node_ids: Collection[str] | None = None,
    seq_from: int | None = None,
    seq_to: int | None = None,
) -> list[TraceEvent]:
    """Ordered LEVEL_0 events for partial replay scope (source of truth)."""
    allowed = set(node_ids) if node_ids is not None else None
    out: list[TraceEvent] = []
    for e in trace.events:
        if seq_from is not None and e.seq < seq_from:
            continue
        if seq_to is not None and e.seq > seq_to:
            continue
        if allowed is not None:
            if e.node_id and e.node_id in allowed:
                out.append(e)
                continue
            target = e.detail.get("target")
            if target and target in allowed:
                out.append(e)
                continue
            if e.kind in (
                TraceEventKind.EXECUTION_START,
                TraceEventKind.EXECUTION_END,
            ):
                out.append(e)
            continue
        out.append(e)
    return out


def replay_steps_match_subset(steps: list, subset: list[TraceEvent]) -> bool:
    if len(steps) != len(subset):
        return False
    for step, event in zip(steps, subset):
        if step.seq != event.seq:
            return False
        if step.kind != event.kind.value:
            return False
        if step.node_id != event.node_id:
            return False
        if step.op != event.op:
            return False
    return True


def path_nodes_from_events(events: list[TraceEvent]) -> list[str]:
    return [
        e.node_id
        for e in events
        if e.kind == TraceEventKind.NODE_ENTER and e.node_id
    ]


def signatures_equal(a: ExecutionTrace, b: ExecutionTrace) -> bool:
    return trace_signatures(a) == trace_signatures(b)
