"""
Performance overlay — post-execution annotation only.

MUST NOT influence scheduling, traversal order, NativeOps, or trace emission.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from typing import Any

from cicada_platform.core.schemas.ir_graph import IrProgramGraph
from cicada_platform.debug.profiler import ExecutionProfiler
from cicada_platform.runtime.trace import ExecutionTrace, TraceEventKind

POST_EXECUTION_ONLY = True


@dataclass(frozen=True)
class PerformanceOverlay:
    """Derived performance annotations for trace visualization (immutable)."""

    hot_paths: list[dict[str, Any]] = field(default_factory=list)
    slow_branches: list[dict[str, Any]] = field(default_factory=list)
    bottlenecks_by_op: list[dict[str, Any]] = field(default_factory=list)
    node_visit_counts: dict[str, int] = field(default_factory=dict)

    @classmethod
    def from_trace(
        cls,
        graph: IrProgramGraph,
        trace: ExecutionTrace,
        *,
        slow_threshold_ms: float = 5.0,
        hot_path_top: int = 5,
    ) -> PerformanceOverlay:
        profiler = ExecutionProfiler.from_trace(trace, slow_threshold_ms=slow_threshold_ms)
        visits: Counter[str] = Counter()
        for e in trace.events:
            if e.kind == TraceEventKind.NODE_ENTER and e.node_id:
                visits[e.node_id] += 1

        timing_by_node = {t.node_id: t for t in profiler.node_timings}
        slow_branches = _slow_branches(trace, timing_by_node, slow_threshold_ms)
        hot_paths = _hot_paths(trace, visits, top=hot_path_top)
        bottlenecks = [
            {
                "op": o.op,
                "total_ms": round(o.total_ms, 3),
                "count": o.count,
                "avg_ms": round(o.total_ms / o.count, 3) if o.count else 0,
                "hot": o.total_ms >= slow_threshold_ms * 2,
            }
            for o in sorted(profiler.op_timings, key=lambda x: x.total_ms, reverse=True)
        ]

        return cls(
            hot_paths=hot_paths,
            slow_branches=slow_branches,
            bottlenecks_by_op=bottlenecks,
            node_visit_counts=dict(visits),
        )

    def summary(self) -> dict[str, Any]:
        return {
            "hot_paths": self.hot_paths,
            "slow_branches": self.slow_branches,
            "bottlenecks_by_op": self.bottlenecks_by_op,
            "top_visited_nodes": sorted(
                self.node_visit_counts.items(),
                key=lambda x: x[1],
                reverse=True,
            )[:10],
        }

    def highlight_segments(self, segments: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Annotate compressed segments with performance flags."""
        slow_nodes = {b["from"] for b in self.slow_branches if b.get("from")}
        hot_nodes = set()
        for hp in self.hot_paths[:3]:
            hot_nodes.update(hp.get("nodes", []))
        out = []
        for seg in segments:
            nid = seg.get("node_id")
            row = dict(seg)
            row["perf"] = {
                "hot_path": nid in hot_nodes if nid else False,
                "slow_branch": nid in slow_nodes if nid else False,
                "visits": self.node_visit_counts.get(nid, 0) if nid else 0,
            }
            out.append(row)
        return out


def _hot_paths(
    trace: ExecutionTrace,
    visits: Counter[str],
    *,
    top: int,
) -> list[dict[str, Any]]:
    """Rank node-id paths by visit frequency (2-grams on enter sequence)."""
    enters = [e.node_id for e in trace.events if e.kind == TraceEventKind.NODE_ENTER and e.node_id]
    bigrams: Counter[tuple[str, str]] = Counter()
    for i in range(len(enters) - 1):
        bigrams[(enters[i], enters[i + 1])] += 1
    ranked = bigrams.most_common(top)
    return [
        {
            "nodes": list(pair),
            "transitions": count,
            "visits": visits.get(pair[0], 0) + visits.get(pair[1], 0),
        }
        for pair, count in ranked
    ]


def _slow_branches(
    trace: ExecutionTrace,
    timing_by_node: dict,
    threshold_ms: float,
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for e in trace.events:
        if e.kind != TraceEventKind.TRANSITION_TAKEN:
            continue
        target = e.detail.get("target")
        if not target or target not in timing_by_node:
            continue
        t = timing_by_node[target]
        if t.duration_ms >= threshold_ms:
            out.append(
                {
                    "from": e.node_id,
                    "edge": e.detail.get("edge"),
                    "to": target,
                    "target_duration_ms": round(t.duration_ms, 3),
                    "seq": e.seq,
                }
            )
    return sorted(out, key=lambda x: x["target_duration_ms"], reverse=True)
