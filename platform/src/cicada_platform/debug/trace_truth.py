"""Trace Truth Contract — equality and roundtrip invariants (analysis layer only)."""

from __future__ import annotations

from cicada_platform.debug.trace_compression import CompressedTrace, compress_trace, decompress_trace
from cicada_platform.runtime.trace import ExecutionTrace, TraceEvent


def traces_equal(a: ExecutionTrace, b: ExecutionTrace) -> bool:
    if a.trace_id != b.trace_id:
        return False
    if len(a.events) != len(b.events):
        return False
    for ea, eb in zip(a.events, b.events):
        if not events_equal(ea, eb):
            return False
    return True


def events_equal(a: TraceEvent, b: TraceEvent) -> bool:
    return a.model_dump() == b.model_dump()


def assert_lossless_roundtrip(trace: ExecutionTrace) -> None:
    """LEVEL_0 canonical trace must round-trip through compress → decompress."""
    compressed = compress_trace(trace, verify_lossless=False)
    restored = decompress_trace(compressed)
    if not traces_equal(trace, restored):
        raise AssertionError(
            f"lossless roundtrip failed: {len(trace.events)} events vs "
            f"{len(restored.events)} after decompress"
        )


def trace_signatures(trace: ExecutionTrace) -> list[tuple[str, str | None, str | None]]:
    return [(e.kind.value, e.node_id, e.op) for e in trace.events]
