"""Trace compression — lossless presentation grouping over LEVEL_0 canonical trace."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from cicada_platform.runtime.trace import ExecutionTrace, TraceEvent, TraceEventKind


@dataclass
class CompressedSegment:
    """One compressed trace segment; ``events`` holds canonical LEVEL_0 payloads."""

    kind: str
    seq_start: int
    seq_end: int
    count: int = 1
    node_id: str | None = None
    op: str | None = None
    detail: dict[str, Any] = field(default_factory=dict)
    events: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class CompressedTrace:
    """Compressed view — derived only; expand via decompress_trace() to LEVEL_0."""

    trace_id: str
    raw_event_count: int
    compressed_event_count: int
    segments: list[CompressedSegment]

    def expand_event_count(self) -> int:
        return sum(len(s.events) for s in self.segments)


def compress_trace(trace: ExecutionTrace, *, verify_lossless: bool = True) -> CompressedTrace:
    """Apply collapse → loop groups → transition aggregation (lossless)."""
    events = trace.events
    segments: list[CompressedSegment] = []
    i = 0
    while i < len(events):
        seg, i = _try_collapse_node_repeat(events, i)
        if seg:
            segments.append(seg)
            continue
        seg, i = _try_group_loop_iteration(events, i)
        if seg:
            segments.append(seg)
            continue
        seg, i = _try_aggregate_transitions(events, i)
        if seg:
            segments.append(seg)
            continue
        e = events[i]
        segments.append(
            CompressedSegment(
                kind="raw",
                seq_start=e.seq,
                seq_end=e.seq,
                count=1,
                node_id=e.node_id,
                op=e.op,
                detail={"kind": e.kind.value},
                events=[e.model_dump()],
            )
        )
        i += 1

    compressed_count = sum(
        1 if s.kind == "raw" else s.count for s in segments
    )
    result = CompressedTrace(
        trace_id=trace.trace_id,
        raw_event_count=len(events),
        compressed_event_count=compressed_count,
        segments=segments,
    )
    if verify_lossless:
        from cicada_platform.debug.trace_truth import assert_lossless_roundtrip

        assert_lossless_roundtrip(trace)
    return result


def decompress_trace(compressed: CompressedTrace) -> ExecutionTrace:
    """Reconstruct canonical LEVEL_0 trace from compressed segments."""
    trace = ExecutionTrace(trace_id=compressed.trace_id)
    for seg in compressed.segments:
        if not seg.events:
            raise ValueError(
                f"segment {seg.kind} [{seg.seq_start}..{seg.seq_end}] missing canonical events"
            )
        for raw in seg.events:
            trace.events.append(TraceEvent.model_validate(raw))
    return trace


def _segment_events(events: list[TraceEvent], i: int, j: int) -> list[dict[str, Any]]:
    return [e.model_dump() for e in events[i:j]]


def _try_collapse_node_repeat(
    events: list[TraceEvent], i: int
) -> tuple[CompressedSegment | None, int]:
    e = events[i]
    if e.kind != TraceEventKind.NODE_ENTER or not e.node_id:
        return None, i
    node_id = e.node_id
    op = e.op
    j = i
    cycles = 0
    while j < len(events):
        if events[j].kind != TraceEventKind.NODE_ENTER or events[j].node_id != node_id:
            break
        k = j + 1
        if k >= len(events) or events[k].kind != TraceEventKind.NODE_EXIT:
            break
        if events[k].node_id != node_id:
            break
        cycles += 1
        j = k + 1
    if cycles < 2:
        return None, i
    return (
        CompressedSegment(
            kind="node_repeat",
            seq_start=e.seq,
            seq_end=events[j - 1].seq,
            count=cycles,
            node_id=node_id,
            op=op,
            detail={"enter_exit_cycles": cycles},
            events=_segment_events(events, i, j),
        ),
        j,
    )


def _try_group_loop_iteration(
    events: list[TraceEvent], i: int
) -> tuple[CompressedSegment | None, int]:
    e = events[i]
    if e.kind != TraceEventKind.TRANSITION_TAKEN:
        return None, i
    edge = e.detail.get("edge") or ""
    if "loop" not in str(edge).lower():
        return None, i
    key = (e.node_id, edge, e.detail.get("target"))
    j = i
    count = 0
    while j < len(events):
        t = events[j]
        if t.kind != TraceEventKind.TRANSITION_TAKEN:
            break
        k = (t.node_id, t.detail.get("edge") or "", t.detail.get("target"))
        if k != key:
            break
        count += 1
        j += 1
    if count < 2:
        return None, i
    return (
        CompressedSegment(
            kind="loop_group",
            seq_start=e.seq,
            seq_end=events[j - 1].seq,
            count=count,
            node_id=e.node_id,
            op=e.op,
            detail={"edge": edge, "iterations": count},
            events=_segment_events(events, i, j),
        ),
        j,
    )


def _try_aggregate_transitions(
    events: list[TraceEvent], i: int
) -> tuple[CompressedSegment | None, int]:
    e = events[i]
    if e.kind not in (TraceEventKind.TRANSITION_TAKEN, TraceEventKind.CONDITION_EVALUATED):
        return None, i
    key = (
        e.kind.value,
        e.node_id,
        e.detail.get("edge"),
        e.detail.get("target"),
        e.detail.get("result"),
    )
    j = i
    while j < len(events) and events[j].kind == e.kind:
        k = (
            events[j].kind.value,
            events[j].node_id,
            events[j].detail.get("edge"),
            events[j].detail.get("target"),
            events[j].detail.get("result"),
        )
        if k != key:
            break
        j += 1
    count = j - i
    if count < 2:
        return None, i
    return (
        CompressedSegment(
            kind="transition_agg",
            seq_start=e.seq,
            seq_end=events[j - 1].seq,
            count=count,
            node_id=e.node_id,
            op=e.op,
            detail={
                "transition_kind": e.kind.value,
                "edge": e.detail.get("edge"),
                "target": e.detail.get("target"),
                "result": e.detail.get("result"),
            },
            events=_segment_events(events, i, j),
        ),
        j,
    )


def filter_replay_steps(steps: list, *, skip_no_ops: bool = True) -> list:
    """
    Presentation-only step filter for replay UI.
    Does not mutate canonical trace; must not be used for integrity checks.
    """
    if not skip_no_ops:
        return steps
    out = []
    for s in steps:
        op = (s.op or "").lower()
        if op in ("noop", "no-op"):
            if s.kind in ("node_enter", "node_exit"):
                continue
        out.append(s)
    return out
