"""A/B execution trace comparison."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from cicada_platform.runtime.trace import ExecutionTrace, TraceEventKind


@dataclass
class TraceDiff:
    trace_a_id: str
    trace_b_id: str
    identical: bool
    event_count_delta: int
    path_a: list[str | None]
    path_b: list[str | None]
    path_only_a: list[str]
    path_only_b: list[str]
    signature_delta: list[dict[str, Any]] = field(default_factory=list)
    kind_counts_a: dict[str, int] = field(default_factory=dict)
    kind_counts_b: dict[str, int] = field(default_factory=dict)

    def summary(self) -> dict[str, Any]:
        return {
            "identical": self.identical,
            "trace_a_id": self.trace_a_id,
            "trace_b_id": self.trace_b_id,
            "event_count_delta": self.event_count_delta,
            "path_only_a": self.path_only_a,
            "path_only_b": self.path_only_b,
            "signature_changes": len(self.signature_delta),
            "kind_counts_a": self.kind_counts_a,
            "kind_counts_b": self.kind_counts_b,
        }


def diff_traces(a: ExecutionTrace, b: ExecutionTrace) -> TraceDiff:
    sig_a = _signature(a)
    sig_b = _signature(b)
    path_a = _path(a)
    path_b = _path(b)
    set_a = set(n for n in path_a if n)
    set_b = set(n for n in path_b if n)
    delta: list[dict[str, Any]] = []
    maxlen = max(len(sig_a), len(sig_b))
    for i in range(maxlen):
        sa = sig_a[i] if i < len(sig_a) else None
        sb = sig_b[i] if i < len(sig_b) else None
        if sa != sb:
            delta.append({"index": i, "a": sa, "b": sb})

    return TraceDiff(
        trace_a_id=a.trace_id,
        trace_b_id=b.trace_id,
        identical=sig_a == sig_b,
        event_count_delta=len(a.events) - len(b.events),
        path_a=path_a,
        path_b=path_b,
        path_only_a=sorted(set_a - set_b),
        path_only_b=sorted(set_b - set_a),
        signature_delta=delta,
        kind_counts_a=_kind_counts(a),
        kind_counts_b=_kind_counts(b),
    )


def _signature(trace: ExecutionTrace) -> list[tuple[str, str | None, str | None]]:
    return [(e.kind.value, e.node_id, e.op) for e in trace.events]


def _path(trace: ExecutionTrace) -> list[str | None]:
    return [e.node_id for e in trace.events if e.kind == TraceEventKind.NODE_ENTER]


def _kind_counts(trace: ExecutionTrace) -> dict[str, int]:
    out: dict[str, int] = {}
    for e in trace.events:
        out[e.kind.value] = out.get(e.kind.value, 0) + 1
    return out
