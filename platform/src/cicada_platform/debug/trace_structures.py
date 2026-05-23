"""Structural derivations from LEVEL_0 trace (intelligence layer, read-only)."""

from __future__ import annotations

from typing import Any

from cicada_platform.runtime.trace import ExecutionTrace, TraceEventKind


def resume_chain_from_trace(trace: ExecutionTrace) -> list[dict[str, Any]]:
    """Suspend/resume pairs from canonical event order."""
    chain: list[dict[str, Any]] = []
    pending_suspend: dict[str, Any] | None = None
    for e in trace.events:
        if e.kind == TraceEventKind.SUSPEND:
            pending_suspend = {
                "trace_id": trace.trace_id,
                "seq": e.seq,
                "node_id": e.node_id,
                "waiting_for": e.detail.get("waiting_for"),
            }
        elif e.kind == TraceEventKind.RESUME and pending_suspend:
            chain.append(
                {
                    **pending_suspend,
                    "resume_seq": e.seq,
                    "resume_mode": e.detail.get("mode"),
                    "resume_target": e.detail.get("target"),
                }
            )
            pending_suspend = None
    return chain
