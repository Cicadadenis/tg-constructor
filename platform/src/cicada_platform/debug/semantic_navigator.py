"""
Semantic Navigation Layer — intent-based navigation over LEVEL_0 trace.

Read-only projection. Does not mutate trace, affect replay, or define semantics.
"""

from __future__ import annotations

from typing import Any

from cicada_platform.core.schemas.ir_graph import IrProgramGraph
from cicada_platform.debug.story_model import (
    ExecutionStory,
    SemanticSegment,
    StoryPhase,
    build_story_from_trace,
    validate_story_lossless,
)
from cicada_platform.runtime.semantic_firewall import validate_level_0_integrity
from cicada_platform.runtime.trace import ExecutionTrace, TraceEventKind

NAVIGATION_LAYER = "semantic_navigation"
READ_ONLY = True


class SemanticNavigator:
    """
    Navigate execution by intent and semantic phase — not by raw node ids alone.

    All outputs are derived groupings over canonical ``ExecutionTrace.events``.
    """

    def __init__(self, graph: IrProgramGraph | None = None) -> None:
        self._graph = graph

    def get_story(self, trace: ExecutionTrace) -> ExecutionStory:
        validate_level_0_integrity(trace)
        story = build_story_from_trace(trace)
        validate_story_lossless(trace, story)
        return story

    def jump_to_phase(
        self,
        trace: ExecutionTrace,
        phase: str | StoryPhase,
    ) -> list[SemanticSegment]:
        """Return semantic segments for a phase (e.g. PROCESS, WAIT)."""
        key = phase.value if isinstance(phase, StoryPhase) else phase.upper()
        story = self.get_story(trace)
        indices = story.phase_index.get(key, ())
        return [story.segments[i] for i in indices]

    def explain_path(self, trace: ExecutionTrace, node_id: str) -> dict[str, Any]:
        """
        Explain how ``node_id`` appears in LEVEL_0 — no inferred edges.
        """
        validate_level_0_integrity(trace)
        events = [e for e in trace.events if e.node_id == node_id]
        transitions = [
            e
            for e in trace.events
            if e.kind == TraceEventKind.TRANSITION_TAKEN
            and (e.node_id == node_id or e.detail.get("target") == node_id)
        ]
        story = self.get_story(trace)
        phases = sorted(
            {seg.phase.value for seg in story.segments if node_id in seg.node_ids}
        )
        graph_meta: dict[str, Any] = {}
        if self._graph and node_id in self._graph.nodes:
            node = self._graph.nodes[node_id]
            graph_meta = {"op": node.op, "meta": dict(node.meta)}

        narrative_parts: list[str] = []
        for e in events:
            narrative_parts.append(f"[{e.seq}] {e.kind.value}")
        if not narrative_parts:
            narrative_parts.append("(node not directly recorded in LEVEL_0)")

        return {
            "node_id": node_id,
            "trace_id": trace.trace_id,
            "semantic_phases": phases,
            "event_count": len(events),
            "transition_count": len(transitions),
            "events": [e.model_dump() for e in events],
            "transitions": [e.model_dump() for e in transitions],
            "narrative": " → ".join(narrative_parts),
            "graph": graph_meta,
            "layer": NAVIGATION_LAYER,
            "read_only": READ_ONLY,
        }

    def collapse_units(self, trace: ExecutionTrace) -> list[dict[str, Any]]:
        """Meaningful units = story segments with intent labels."""
        story = self.get_story(trace)
        return [
            {
                "phase": seg.phase.value,
                "intent": seg.intent,
                "seq_range": [seg.seq_start, seg.seq_end],
                "nodes": list(seg.node_ids),
            }
            for seg in story.segments
        ]

    def navigate_by_intent(self, trace: ExecutionTrace, intent_keyword: str) -> list[SemanticSegment]:
        """Filter segments whose intent string contains keyword (case-insensitive)."""
        kw = intent_keyword.lower()
        story = self.get_story(trace)
        return [s for s in story.segments if kw in s.intent.lower() or kw in s.phase.value.lower()]
