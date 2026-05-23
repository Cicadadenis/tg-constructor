"""
Offline graph execution replay — LEVEL_0 canonical events only.

MUST NOT read CompressedTrace or SmartTraceView output for replay steps.
"""

from __future__ import annotations

REPLAY_LEVEL_0_ONLY = True

from dataclasses import dataclass, field
from typing import Any, Collection

from cicada_platform.core.schemas.ir_graph import IrProgramGraph
from cicada_platform.debug.hooks import dispatch_trace_event
from cicada_platform.debug.replay_integrity import (
    canonical_subset_events,
    path_nodes_from_events,
)
from cicada_platform.debug.trace_compression import filter_replay_steps
from cicada_platform.runtime.semantic_firewall import (
    validate_for_replay,
    validate_replay_steps_match_level_0,
)
from cicada_platform.runtime.trace import ExecutionTrace, TraceEventKind


@dataclass
class ReplayStep:
    seq: int
    kind: str
    node_id: str | None
    op: str | None
    detail: dict[str, Any] = field(default_factory=dict)


@dataclass
class ReplayResult:
    """
    Canonical replay uses ``steps`` (full fidelity).
    ``display_steps`` is UI-only when skip_no_ops=True.
    Path/edge state is always derived from canonical events.
    """

    trace_id: str
    steps: list[ReplayStep]
    path_nodes: list[str]
    edges: list[dict[str, Any]]
    deterministic: bool = True
    side_effects: bool = False
    partial: bool = False
    skipped_no_ops: int = 0
    display_steps: list[ReplayStep] = field(default_factory=list)

    @property
    def canonical_step_count(self) -> int:
        return len(self.steps)


class GraphExecutionReplayer:
    """
    Replays execution by walking recorded trace events.
    Does not invoke NativeOps or transport (CICADA_EXEC_REPLAY_MODE).
    Not an execution engine — observability replay only.
    """

    def __init__(self, graph: IrProgramGraph, trace: ExecutionTrace) -> None:
        self._graph = graph
        self._trace = trace

    def replay(
        self,
        *,
        fire_hooks: bool = True,
        skip_no_ops: bool = False,
        node_ids: Collection[str] | None = None,
        seq_from: int | None = None,
        seq_to: int | None = None,
    ) -> ReplayResult:
        validate_for_replay(self._trace)
        events = canonical_subset_events(
            self._trace,
            node_ids=node_ids,
            seq_from=seq_from,
            seq_to=seq_to,
        )
        partial = node_ids is not None or seq_from is not None or seq_to is not None

        steps: list[ReplayStep] = []
        edges: list[dict[str, Any]] = []

        for e in events:
            step = ReplayStep(
                seq=e.seq,
                kind=e.kind.value,
                node_id=e.node_id,
                op=e.op,
                detail=dict(e.detail),
            )
            steps.append(step)
            if fire_hooks:
                dispatch_trace_event(e, self._trace)

            if e.kind == TraceEventKind.TRANSITION_TAKEN:
                edges.append(
                    {
                        "seq": e.seq,
                        "from": e.node_id,
                        "edge": e.detail.get("edge"),
                        "to": e.detail.get("target"),
                    }
                )

        path_nodes = path_nodes_from_events(events)
        display_steps = filter_replay_steps(steps, skip_no_ops=True) if skip_no_ops else list(steps)
        skipped = len(steps) - len(display_steps)

        validate_replay_steps_match_level_0(
            self._trace, steps, partial=partial
        )

        return ReplayResult(
            trace_id=self._trace.trace_id,
            steps=steps,
            display_steps=display_steps,
            path_nodes=path_nodes,
            edges=edges,
            deterministic=True,
            side_effects=False,
            partial=partial,
            skipped_no_ops=skipped,
        )

    def replay_subgraph(
        self,
        node_ids: Collection[str],
        *,
        fire_hooks: bool = False,
        skip_no_ops: bool = True,
    ) -> ReplayResult:
        """Partial replay limited to nodes in subgraph scope."""
        return self.replay(
            fire_hooks=fire_hooks,
            skip_no_ops=skip_no_ops,
            node_ids=node_ids,
        )

    def step_at(self, seq: int) -> ReplayStep | None:
        for s in self.replay(fire_hooks=False).steps:
            if s.seq == seq:
                return s
        return None


def replay_trace(
    graph: IrProgramGraph,
    trace: ExecutionTrace,
    *,
    fire_hooks: bool = False,
    skip_no_ops: bool = False,
    node_ids: Collection[str] | None = None,
) -> ReplayResult:
    return GraphExecutionReplayer(graph, trace).replay(
        fire_hooks=fire_hooks,
        skip_no_ops=skip_no_ops,
        node_ids=node_ids,
    )
