"""
Smart Trace View — strictly read-only abstraction over canonical trace.

MUST NOT mutate ``ExecutionTrace.events``, ordering, or runtime/session state.
Category filters affect exported views only, never replay integrity checks.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any, Mapping

from cicada_platform.core.schemas.ir_graph import IrProgramGraph
from cicada_platform.debug.trace_compression import CompressedTrace, compress_trace
from cicada_platform.debug.trace_levels import TraceLevel
from cicada_platform.debug.trace_structures import resume_chain_from_trace
from cicada_platform.runtime.trace import ExecutionTrace, TraceEventKind

READ_ONLY_LAYER = True


class TraceCategoryFilter(StrEnum):
    ALL = "all"
    CONDITIONS = "conditions"
    OPS = "ops"
    ERRORS = "errors"


_CONDITION_KINDS = frozenset(
    {TraceEventKind.CONDITION_EVALUATED, TraceEventKind.TRANSITION_TAKEN}
)
_OP_KINDS = frozenset(
    {
        TraceEventKind.NODE_ENTER,
        TraceEventKind.NODE_EXIT,
        TraceEventKind.ACTION_EXECUTED,
    }
)
_ERROR_KINDS = frozenset({TraceEventKind.ERROR_EVENT})


class SmartTraceView:
    """Derived views only — ``build()`` returns new dicts; trace stays immutable."""

    def __init__(
        self,
        graph: IrProgramGraph,
        trace: ExecutionTrace,
        *,
        level: TraceLevel = TraceLevel.LEVEL_1,
        category: TraceCategoryFilter = TraceCategoryFilter.ALL,
    ) -> None:
        self.graph = graph
        self._trace = trace
        self.level = level
        self.category = category
        self._compressed = compress_trace(trace)

    @property
    def trace(self) -> ExecutionTrace:
        """Canonical LEVEL_0 source (read-only by contract)."""
        return self._trace

    @property
    def compressed(self) -> CompressedTrace:
        return self._compressed

    def build(self) -> Mapping[str, Any]:
        _assert_trace_unchanged(self._trace)
        if self.level == TraceLevel.LEVEL_0:
            doc = self._level_0()
        elif self.level == TraceLevel.LEVEL_1:
            doc = self._level_1()
        else:
            doc = self._level_2()
        from cicada_platform.runtime.semantic_firewall import validate_smart_trace_view

        validate_smart_trace_view(doc, self._trace)
        return doc

    def _level_0(self) -> dict[str, Any]:
        events = [e.model_dump() for e in self._filtered_events()]
        return {
            "level": TraceLevel.LEVEL_0.name,
            "trace_id": self.trace.trace_id,
            "mode": "raw",
            "event_count": len(events),
            "events": events,
        }

    def _level_1(self) -> dict[str, Any]:
        segs = []
        for s in self._compressed.segments:
            if not self._segment_matches_category(s):
                continue
            segs.append(
                {
                    "kind": s.kind,
                    "seq_start": s.seq_start,
                    "seq_end": s.seq_end,
                    "count": s.count,
                    "node_id": s.node_id,
                    "op": s.op,
                    "detail": s.detail,
                }
            )
        return {
            "level": TraceLevel.LEVEL_1.name,
            "trace_id": self.trace.trace_id,
            "mode": "condensed_flow",
            "raw_event_count": self._compressed.raw_event_count,
            "segment_count": len(segs),
            "segments": segs,
            "flow": self._high_level_flow(),
        }

    def _level_2(self) -> dict[str, Any]:
        flow = self._high_level_flow()
        actions = [
            e for e in self.trace.events if e.kind == TraceEventKind.ACTION_EXECUTED
        ]
        errors = [e for e in self.trace.events if e.kind == TraceEventKind.ERROR_EVENT]
        suspends = [e for e in self.trace.events if e.kind == TraceEventKind.SUSPEND]
        return {
            "level": TraceLevel.LEVEL_2.name,
            "trace_id": self.trace.trace_id,
            "mode": "execution_summary",
            "summary": {
                "inbound": _first_detail(self.trace, TraceEventKind.EXECUTION_START),
                "effects": _last_detail(self.trace, TraceEventKind.EXECUTION_END),
                "handler_entries": len(
                    [e for e in self.trace.events if e.kind == TraceEventKind.HANDLER_MATCHED]
                ),
                "actions_executed": len(actions),
                "errors": len(errors),
                "suspends": len(suspends),
                "resume_pairs": len(resume_chain_from_trace(self.trace)),
            },
            "flow_narrative": _narrate_flow(flow),
            "flow": flow,
        }

    def _filtered_events(self):
        for e in self.trace.events:
            if self._event_matches_category(e.kind):
                yield e

    def _event_matches_category(self, kind: TraceEventKind) -> bool:
        if self.category == TraceCategoryFilter.ALL:
            return True
        if self.category == TraceCategoryFilter.CONDITIONS:
            return kind in _CONDITION_KINDS
        if self.category == TraceCategoryFilter.OPS:
            return kind in _OP_KINDS
        if self.category == TraceCategoryFilter.ERRORS:
            return kind in _ERROR_KINDS
        return True

    def _segment_matches_category(self, seg) -> bool:
        if self.category == TraceCategoryFilter.ALL:
            return True
        tk = seg.detail.get("transition_kind") or seg.detail.get("kind", "")
        if self.category == TraceCategoryFilter.CONDITIONS:
            return seg.kind in ("transition_agg", "loop_group") or "condition" in tk
        if self.category == TraceCategoryFilter.OPS:
            return seg.kind in ("node_repeat", "raw") and seg.op not in (None, "Noop")
        if self.category == TraceCategoryFilter.ERRORS:
            return tk == TraceEventKind.ERROR_EVENT.value
        return True

    def _high_level_flow(self) -> list[dict[str, Any]]:
        """Abstract path: handler → ops → branches → suspend/resume."""
        flow: list[dict[str, Any]] = []
        for e in self.trace.events:
            if e.kind == TraceEventKind.HANDLER_MATCHED:
                flow.append({"step": "handler", "entry": e.detail.get("entry_node")})
            elif e.kind == TraceEventKind.ACTION_EXECUTED:
                flow.append({"step": "action", "node_id": e.node_id, "op": e.op})
            elif e.kind == TraceEventKind.CONDITION_EVALUATED:
                flow.append(
                    {"step": "condition", "node_id": e.node_id, "result": e.detail.get("result")}
                )
            elif e.kind == TraceEventKind.SUSPEND:
                flow.append(
                    {"step": "suspend", "node_id": e.node_id, "waiting_for": e.detail.get("waiting_for")}
                )
            elif e.kind == TraceEventKind.RESUME:
                flow.append({"step": "resume", "mode": e.detail.get("mode")})
            elif e.kind == TraceEventKind.ERROR_EVENT:
                flow.append({"step": "error", "node_id": e.node_id, "detail": e.detail})
        return flow


def _first_detail(trace: ExecutionTrace, kind: TraceEventKind) -> dict:
    for e in trace.events:
        if e.kind == kind:
            return dict(e.detail)
    return {}


def _last_detail(trace: ExecutionTrace, kind: TraceEventKind) -> dict:
    for e in reversed(trace.events):
        if e.kind == kind:
            return dict(e.detail)
    return {}


def _narrate_flow(flow: list[dict[str, Any]]) -> str:
    parts: list[str] = []
    for step in flow:
        s = step.get("step", "?")
        if s == "handler":
            parts.append(f"handler→{step.get('entry')}")
        elif s == "action":
            parts.append(f"{step.get('op')}@{step.get('node_id')}")
        elif s == "condition":
            parts.append(f"if@{step.get('node_id')}={step.get('result')}")
        elif s == "suspend":
            parts.append(f"suspend({step.get('waiting_for')})")
        elif s == "resume":
            parts.append(f"resume({step.get('mode')})")
        elif s == "error":
            parts.append("ERROR")
    return " → ".join(parts) if parts else "(empty flow)"


def _assert_trace_unchanged(trace: ExecutionTrace) -> None:
    """Runtime guard: intelligence layer must not reorder or drop canonical events."""
    if trace.events and trace.events[0].seq != 1:
        raise RuntimeError("trace truth violated: canonical event ordering mutated")
