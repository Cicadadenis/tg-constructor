"""Execution Story Model — semantic phases as lossless LEVEL_0 groupings."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

from cicada_platform.runtime.trace import ExecutionTrace, TraceEvent, TraceEventKind


class StoryPhase(StrEnum):
    INIT = "INIT"
    ROUTE = "ROUTE"
    PROCESS = "PROCESS"
    WAIT = "WAIT"
    RESUME = "RESUME"
    FINALIZE = "FINALIZE"


def phase_for_event(kind: TraceEventKind) -> StoryPhase:
    if kind == TraceEventKind.EXECUTION_START:
        return StoryPhase.INIT
    if kind in (TraceEventKind.HANDLER_MATCHED, TraceEventKind.TRANSITION_TAKEN, TraceEventKind.CONDITION_EVALUATED):
        return StoryPhase.ROUTE
    if kind in (
        TraceEventKind.NODE_ENTER,
        TraceEventKind.NODE_EXIT,
        TraceEventKind.ACTION_EXECUTED,
        TraceEventKind.ERROR_EVENT,
    ):
        return StoryPhase.PROCESS
    if kind == TraceEventKind.SUSPEND:
        return StoryPhase.WAIT
    if kind == TraceEventKind.RESUME:
        return StoryPhase.RESUME
    if kind == TraceEventKind.EXECUTION_END:
        return StoryPhase.FINALIZE
    return StoryPhase.PROCESS


@dataclass(frozen=True)
class SemanticSegment:
    """One semantic phase span — references LEVEL_0 seq range only."""

    phase: StoryPhase
    seq_start: int
    seq_end: int
    event_seqs: tuple[int, ...]
    node_ids: tuple[str, ...]
    intent: str
    unit_count: int = 1

    def to_dict(self) -> dict[str, Any]:
        return {
            "phase": self.phase.value,
            "seq_start": self.seq_start,
            "seq_end": self.seq_end,
            "event_seqs": list(self.event_seqs),
            "node_ids": list(self.node_ids),
            "intent": self.intent,
            "unit_count": self.unit_count,
        }


@dataclass(frozen=True)
class ExecutionStory:
    """Human-level storyline — derived, non-authoritative."""

    trace_id: str
    segments: tuple[SemanticSegment, ...]
    storyline: str
    phase_index: dict[str, tuple[int, ...]] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "trace_id": self.trace_id,
            "storyline": self.storyline,
            "segments": [s.to_dict() for s in self.segments],
            "phase_index": {k: list(v) for k, v in self.phase_index.items()},
        }


def build_story_from_trace(trace: ExecutionTrace) -> ExecutionStory:
    """Convert LEVEL_0 → semantic segments (lossless grouping)."""
    if not trace.events:
        return ExecutionStory(
            trace_id=trace.trace_id,
            segments=(),
            storyline="(empty execution)",
            phase_index={},
        )

    segments: list[SemanticSegment] = []
    current_phase: StoryPhase | None = None
    bucket_seqs: list[int] = []
    bucket_nodes: set[str] = set()

    def flush() -> None:
        nonlocal current_phase, bucket_seqs, bucket_nodes
        if not bucket_seqs or current_phase is None:
            bucket_seqs = []
            bucket_nodes = set()
            return
        segments.append(
            SemanticSegment(
                phase=current_phase,
                seq_start=bucket_seqs[0],
                seq_end=bucket_seqs[-1],
                event_seqs=tuple(bucket_seqs),
                node_ids=tuple(sorted(bucket_nodes)),
                intent=_intent_label(current_phase, bucket_nodes),
                unit_count=len(bucket_seqs),
            )
        )
        bucket_seqs = []
        bucket_nodes = set()

    for e in trace.events:
        phase = phase_for_event(e.kind)
        if current_phase is not None and phase != current_phase:
            flush()
        current_phase = phase
        bucket_seqs.append(e.seq)
        if e.node_id:
            bucket_nodes.add(e.node_id)
        target = e.detail.get("target")
        if target:
            bucket_nodes.add(str(target))
    flush()

    phase_index: dict[str, list[int]] = {}
    for i, seg in enumerate(segments):
        phase_index.setdefault(seg.phase.value, []).append(i)

    storyline = _build_storyline(segments)
    return ExecutionStory(
        trace_id=trace.trace_id,
        segments=tuple(segments),
        storyline=storyline,
        phase_index={k: tuple(v) for k, v in phase_index.items()},
    )


def _intent_label(phase: StoryPhase, nodes: set[str]) -> str:
    labels = {
        StoryPhase.INIT: "initialize execution context",
        StoryPhase.ROUTE: "route inbound event to handler",
        StoryPhase.PROCESS: "execute graph operations",
        StoryPhase.WAIT: "suspend awaiting user input",
        StoryPhase.RESUME: "resume suspended flow",
        StoryPhase.FINALIZE: "complete execution",
    }
    base = labels.get(phase, phase.value)
    if nodes and phase in (StoryPhase.PROCESS, StoryPhase.ROUTE):
        return f"{base} ({len(nodes)} node(s))"
    return base


def _build_storyline(segments: list[SemanticSegment]) -> str:
    parts = [f"{s.phase.value}: {s.intent}" for s in segments]
    return " → ".join(parts) if parts else "(empty)"


def validate_story_lossless(trace: ExecutionTrace, story: ExecutionStory) -> None:
    """Every LEVEL_0 seq appears exactly once in story segments."""
    if story.trace_id != trace.trace_id:
        raise ValueError("story trace_id mismatch")
    covered: list[int] = []
    for seg in story.segments:
        covered.extend(seg.event_seqs)
    expected = [e.seq for e in trace.events]
    if sorted(covered) != expected:
        raise ValueError(
            f"story not lossless: covered {len(covered)} vs {len(expected)} events"
        )
    recorded_nodes = {e.node_id for e in trace.events if e.node_id} | {
        str(e.detail.get("target"))
        for e in trace.events
        if e.detail.get("target")
    }
    recorded_nodes.discard("None")
    for seg in story.segments:
        for nid in seg.node_ids:
            if nid not in recorded_nodes:
                raise ValueError(f"story references unknown node {nid!r}")
