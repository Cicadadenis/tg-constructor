"""Trace export document builder."""

from __future__ import annotations

from typing import Any

from cicada_platform.core.schemas.ir_graph import IrProgramGraph
from cicada_platform.debug.profiler import ExecutionProfiler
from cicada_platform.debug.trace_structures import resume_chain_from_trace
from cicada_platform.runtime.trace import ExecutionTrace, TraceEventKind


def build_trace_export(
    graph: IrProgramGraph,
    trace: ExecutionTrace,
    *,
    trace_id: str | None = None,
) -> dict[str, Any]:
    if trace_id and trace.trace_id != trace_id:
        from cicada_platform.debug.trace_store import get_trace_store

        stored = get_trace_store().get(trace_id)
        if stored is None:
            raise KeyError(f"trace_id not found: {trace_id!r}")
        trace = stored

    timeline = _nodes_timeline(trace)
    edges = _edges_taken(trace)
    suspended = _suspended_states(trace)
    profiler = ExecutionProfiler.from_trace(trace)

    return {
        "trace_id": trace.trace_id,
        "event_count": len(trace.events),
        "nodes_timeline": timeline,
        "edges_taken": edges,
        "resume_events": resume_chain_from_trace(trace),
        "suspended_states": suspended,
        "profiler": profiler.summary(),
        "events": trace.to_list(),
    }


def _nodes_timeline(trace: ExecutionTrace) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for e in trace.events:
        if e.kind in (TraceEventKind.NODE_ENTER, TraceEventKind.NODE_EXIT, TraceEventKind.ACTION_EXECUTED):
            rows.append(
                {
                    "seq": e.seq,
                    "kind": e.kind.value,
                    "node_id": e.node_id,
                    "op": e.op,
                    "detail": dict(e.detail),
                }
            )
    return rows


def _edges_taken(trace: ExecutionTrace) -> list[dict[str, Any]]:
    return [
        {
            "seq": e.seq,
            "node_id": e.node_id,
            "edge": e.detail.get("edge"),
            "target": e.detail.get("target"),
            "result": e.detail.get("result"),
        }
        for e in trace.events
        if e.kind in (TraceEventKind.TRANSITION_TAKEN, TraceEventKind.CONDITION_EVALUATED)
    ]


def _suspended_states(trace: ExecutionTrace) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for e in trace.events:
        if e.kind == TraceEventKind.SUSPEND:
            out.append(
                {
                    "seq": e.seq,
                    "node_id": e.node_id,
                    "waiting_for": e.detail.get("waiting_for"),
                }
            )
    return out
