"""Execution profiler — derived from trace timestamps (observability only)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from cicada_platform.runtime.trace import ExecutionTrace, TraceEventKind


@dataclass(frozen=True)
class NodeTiming:
    node_id: str
    op: str | None
    duration_ms: float
    seq_enter: int
    seq_exit: int


@dataclass(frozen=True)
class OpTiming:
    op: str
    total_ms: float
    count: int


@dataclass
class ExecutionProfiler:
    node_timings: list[NodeTiming]
    op_timings: list[OpTiming]
    slow_nodes: list[NodeTiming]

    @classmethod
    def from_trace(cls, trace: ExecutionTrace, *, slow_threshold_ms: float = 5.0) -> ExecutionProfiler:
        node_timings: list[NodeTiming] = []
        enter_stack: dict[str, tuple[int, str, datetime]] = {}
        op_acc: dict[str, list[float]] = {}

        for e in trace.events:
            if e.kind == TraceEventKind.NODE_ENTER and e.node_id:
                enter_stack[e.node_id] = (e.seq, e.op or "", _parse_ts(e.timestamp))
            elif e.kind == TraceEventKind.NODE_EXIT and e.node_id and e.node_id in enter_stack:
                seq_in, op, t0 = enter_stack.pop(e.node_id)
                dt = (_parse_ts(e.timestamp) - t0).total_seconds() * 1000.0
                node_timings.append(
                    NodeTiming(
                        node_id=e.node_id,
                        op=e.op or op,
                        duration_ms=dt,
                        seq_enter=seq_in,
                        seq_exit=e.seq,
                    )
                )
                key = e.op or op or "unknown"
                op_acc.setdefault(key, []).append(dt)

        op_timings = [
            OpTiming(op=op, total_ms=sum(vals), count=len(vals))
            for op, vals in sorted(op_acc.items())
        ]
        slow = sorted(
            [n for n in node_timings if n.duration_ms >= slow_threshold_ms],
            key=lambda n: n.duration_ms,
            reverse=True,
        )
        return cls(node_timings=node_timings, op_timings=op_timings, slow_nodes=slow)

    def summary(self) -> dict:
        return {
            "node_count": len(self.node_timings),
            "op_count": len(self.op_timings),
            "slow_nodes": [
                {
                    "node_id": n.node_id,
                    "op": n.op,
                    "duration_ms": round(n.duration_ms, 3),
                }
                for n in self.slow_nodes
            ],
            "ops": [
                {
                    "op": o.op,
                    "total_ms": round(o.total_ms, 3),
                    "count": o.count,
                    "avg_ms": round(o.total_ms / o.count, 3) if o.count else 0,
                }
                for o in self.op_timings
            ],
        }


def _parse_ts(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))
