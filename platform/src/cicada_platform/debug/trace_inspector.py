"""Execution Trace Inspector — visualize and step through traces."""

from __future__ import annotations

from typing import Any, Iterator

from cicada_platform.core.schemas.ir_graph import IrProgramGraph
from cicada_platform.debug.performance_overlay import PerformanceOverlay
from cicada_platform.debug.profiler import ExecutionProfiler
from cicada_platform.debug.replay import GraphExecutionReplayer, ReplayStep
from cicada_platform.debug.trace_compression import CompressedTrace, compress_trace
from cicada_platform.debug.trace_diff import TraceDiff, diff_traces
from cicada_platform.debug.trace_export import build_trace_export
from cicada_platform.debug.trace_structures import resume_chain_from_trace
from cicada_platform.debug.trace_levels import TraceLevel
from cicada_platform.debug.trace_view import SmartTraceView, TraceCategoryFilter
from cicada_platform.runtime.trace import ExecutionTrace, TraceEventKind


class TraceInspector:
    def __init__(self, graph: IrProgramGraph, trace: ExecutionTrace) -> None:
        self.graph = graph
        self.trace = trace
        self._replayer = GraphExecutionReplayer(graph, trace)
        self._profiler = ExecutionProfiler.from_trace(trace)
        self._compressed = compress_trace(trace)

    @property
    def trace_id(self) -> str:
        return self.trace.trace_id

    @property
    def compressed(self) -> CompressedTrace:
        return self._compressed

    def overview(self) -> dict[str, Any]:
        return {
            "trace_id": self.trace_id,
            "event_count": len(self.trace.events),
            "compressed_segments": len(self._compressed.segments),
            "resume_chain": resume_chain_from_trace(self.trace),
            "profiler": self._profiler.summary(),
        }

    def export(self) -> dict[str, Any]:
        return build_trace_export(self.graph, self.trace)

    def smart_view(
        self,
        level: TraceLevel = TraceLevel.LEVEL_1,
        *,
        category: TraceCategoryFilter = TraceCategoryFilter.ALL,
    ) -> dict[str, Any]:
        view = SmartTraceView(self.graph, self.trace, level=level, category=category)
        doc = view.build()
        if level != TraceLevel.LEVEL_0:
            overlay = self.performance_overlay()
            if "segments" in doc:
                doc["segments"] = overlay.highlight_segments(doc["segments"])
            doc["performance"] = overlay.summary()
        return doc

    def performance_overlay(self) -> PerformanceOverlay:
        overlay = PerformanceOverlay.from_trace(self.graph, self.trace)
        from cicada_platform.runtime.semantic_firewall import validate_overlay_annotation_only

        validate_overlay_annotation_only(overlay.summary(), self.trace)
        return overlay

    def diff(self, other: ExecutionTrace) -> TraceDiff:
        return diff_traces(self.trace, other)

    def render(
        self,
        level: TraceLevel = TraceLevel.LEVEL_0,
        *,
        category: TraceCategoryFilter = TraceCategoryFilter.ALL,
    ) -> str:
        if level == TraceLevel.LEVEL_0:
            return self.render_text(category=category)
        if level == TraceLevel.LEVEL_1:
            return self._render_condensed(category=category)
        return self._render_summary()

    def timeline(self) -> list[dict[str, Any]]:
        return self.export()["nodes_timeline"]

    def resume_chain_visualization(self) -> list[dict[str, Any]]:
        chain = resume_chain_from_trace(self.trace)
        viz: list[dict[str, Any]] = []
        for i, link in enumerate(chain):
            viz.append(
                {
                    "index": i,
                    "from_node": link.get("node_id"),
                    "waiting_for": link.get("waiting_for"),
                    "resume_mode": link.get("resume_mode"),
                    "resume_target": link.get("resume_target"),
                    "resume_seq": link.get("resume_seq"),
                }
            )
        return viz

    def inspect_node(self, node_id: str) -> dict[str, Any] | None:
        node = self.graph.nodes.get(node_id)
        if not node:
            return None
        events = [e for e in self.trace.events if e.node_id == node_id]
        timing = next((t for t in self._profiler.node_timings if t.node_id == node_id), None)
        overlay = self.performance_overlay()
        return {
            "node_id": node_id,
            "op": node.op,
            "payload": node.payload,
            "meta": node.meta,
            "events": [e.model_dump() for e in events],
            "duration_ms": timing.duration_ms if timing else None,
            "visits": overlay.node_visit_counts.get(node_id, 0),
        }

    def iter_steps(self, *, skip_no_ops: bool = False) -> Iterator[ReplayStep]:
        result = self._replayer.replay(fire_hooks=False, skip_no_ops=skip_no_ops)
        yield from result.display_steps if skip_no_ops else result.steps

    def replay_step_by_step(
        self,
        *,
        fire_hooks: bool = True,
        skip_no_ops: bool = False,
        node_ids: set[str] | None = None,
    ) -> list[ReplayStep]:
        return self._replayer.replay(
            fire_hooks=fire_hooks,
            skip_no_ops=skip_no_ops,
            node_ids=node_ids,
        ).steps

    def replay_partial(
        self,
        node_ids: set[str],
        *,
        skip_no_ops: bool = True,
    ) -> list[ReplayStep]:
        return self._replayer.replay_subgraph(node_ids, skip_no_ops=skip_no_ops).steps

    def slow_nodes(self, threshold_ms: float = 5.0) -> list[dict[str, Any]]:
        prof = ExecutionProfiler.from_trace(self.trace, slow_threshold_ms=threshold_ms)
        return [
            {"node_id": n.node_id, "op": n.op, "duration_ms": n.duration_ms}
            for n in prof.slow_nodes
        ]

    def render_text(
        self,
        *,
        category: TraceCategoryFilter = TraceCategoryFilter.ALL,
    ) -> str:
        lines = [f"trace_id={self.trace_id}", f"events={len(self.trace.events)}", ""]
        view = SmartTraceView(self.graph, self.trace, level=TraceLevel.LEVEL_0, category=category)
        for e in view._filtered_events():
            if e.kind in (
                TraceEventKind.NODE_ENTER,
                TraceEventKind.NODE_EXIT,
                TraceEventKind.SUSPEND,
                TraceEventKind.RESUME,
                TraceEventKind.TRANSITION_TAKEN,
                TraceEventKind.ERROR_EVENT,
                TraceEventKind.ACTION_EXECUTED,
            ):
                lines.append(
                    f"  [{e.seq:04d}] {e.kind.value} node={e.node_id!r} op={e.op!r}"
                )
        return "\n".join(lines)

    def _render_condensed(self, *, category: TraceCategoryFilter) -> str:
        doc = self.smart_view(TraceLevel.LEVEL_1, category=category)
        lines = [
            f"trace_id={self.trace_id}",
            f"level=LEVEL_1 raw={doc['raw_event_count']} segments={doc['segment_count']}",
            "",
        ]
        for seg in doc.get("segments", []):
            perf = seg.get("perf", {})
            flags = []
            if perf.get("hot_path"):
                flags.append("HOT")
            if perf.get("slow_branch"):
                flags.append("SLOW")
            flag_s = f" [{' '.join(flags)}]" if flags else ""
            if seg["kind"] == "node_repeat":
                lines.append(
                    f"  [{seg['seq_start']:04d}..{seg['seq_end']:04d}] "
                    f"x{seg['count']} {seg['op']}@{seg['node_id']}{flag_s}"
                )
            elif seg["kind"] == "loop_group":
                lines.append(
                    f"  [{seg['seq_start']:04d}..{seg['seq_end']:04d}] "
                    f"loop x{seg['count']} edge={seg['detail'].get('edge')}{flag_s}"
                )
            elif seg["kind"] == "transition_agg":
                lines.append(
                    f"  [{seg['seq_start']:04d}..{seg['seq_end']:04d}] "
                    f"transition x{seg['count']}{flag_s}"
                )
            else:
                lines.append(
                    f"  [{seg['seq_start']:04d}] {seg['detail'].get('kind')} "
                    f"node={seg['node_id']!r}{flag_s}"
                )
        return "\n".join(lines)

    def _render_summary(self) -> str:
        doc = self.smart_view(TraceLevel.LEVEL_2)
        s = doc["summary"]
        lines = [
            f"trace_id={self.trace_id}",
            "level=LEVEL_2 execution_summary",
            f"  actions={s['actions_executed']} errors={s['errors']} suspends={s['suspends']}",
            f"  flow: {doc['flow_narrative']}",
        ]
        perf = doc.get("performance", {})
        if perf.get("slow_branches"):
            lines.append(f"  slow_branches={len(perf['slow_branches'])}")
        if perf.get("hot_paths"):
            lines.append(f"  hot_paths={len(perf['hot_paths'])}")
        return "\n".join(lines)
