"""
Semantic Firewall — blocks accidental semantic drift from intelligence layer.

Execution is the semantics authority; trace is immutable record;
intelligence must remain a pure projection space (non-authoritative).
"""

from __future__ import annotations

from typing import Any, Mapping, Sequence

from cicada_platform.runtime.trace import ExecutionTrace, TraceEventKind

SEMANTIC_AUTHORITY = "execution"
PROJECTION_ONLY = "intelligence"


class SemanticFirewallError(RuntimeError):
    """Raised when a derived layer would alter execution equivalence class."""


def validate_level_0_integrity(trace: ExecutionTrace) -> None:
    """Canonical trace structural invariants (LEVEL_0)."""
    if not trace.trace_id:
        raise SemanticFirewallError("trace_id required")
    expected_seq = 1
    for e in trace.events:
        if e.seq != expected_seq:
            raise SemanticFirewallError(
                f"non-contiguous seq: expected {expected_seq}, got {e.seq}"
            )
        expected_seq += 1
        if not isinstance(e.kind, TraceEventKind):
            raise SemanticFirewallError(f"invalid event kind at seq={e.seq}")


def validate_for_replay(trace: ExecutionTrace) -> None:
    """Must pass before any replay path uses the trace."""
    validate_level_0_integrity(trace)
    if not isinstance(trace, ExecutionTrace):
        raise SemanticFirewallError("replay source must be ExecutionTrace (LEVEL_0)")
    # Reject non-canonical containers masquerading as trace.
    if type(trace).__name__ != "ExecutionTrace":
        raise SemanticFirewallError("replay source type is not canonical ExecutionTrace")


def equivalence_signature(trace: ExecutionTrace) -> tuple[Any, ...]:
    """Stable equivalence class for LEVEL_0 (used in tests and validation)."""
    return tuple(
        (e.kind.value, e.seq, e.node_id, e.op, _frozen_detail(e.detail))
        for e in trace.events
    )


def assert_same_equivalence_class(a: ExecutionTrace, b: ExecutionTrace) -> None:
    if equivalence_signature(a) != equivalence_signature(b):
        raise SemanticFirewallError("equivalence class mismatch between traces")


def validate_replay_steps_match_level_0(
    trace: ExecutionTrace,
    steps: Sequence[Any],
    *,
    partial: bool = False,
) -> None:
    """Replay steps must be 1:1 with canonical events (or declared subset)."""
    validate_level_0_integrity(trace)
    if partial:
        for s in steps:
            match = next((e for e in trace.events if e.seq == s.seq), None)
            if match is None:
                raise SemanticFirewallError(f"replay step seq={s.seq} not in LEVEL_0")
            if match.kind.value != s.kind:
                raise SemanticFirewallError(f"replay kind drift at seq={s.seq}")
            if match.node_id != s.node_id or match.op != s.op:
                raise SemanticFirewallError(f"replay node/op drift at seq={s.seq}")
        return

    if len(steps) != len(trace.events):
        raise SemanticFirewallError(
            f"full replay must cover all events: {len(steps)} vs {len(trace.events)}"
        )
    for step, event in zip(steps, trace.events):
        if step.seq != event.seq or step.kind != event.kind.value:
            raise SemanticFirewallError(f"replay diverges at seq={event.seq}")
        if step.node_id != event.node_id or step.op != event.op:
            raise SemanticFirewallError(f"replay node/op drift at seq={event.seq}")


def validate_smart_trace_view(doc: Mapping[str, Any], trace: ExecutionTrace) -> None:
    """
    Views must not introduce nodes, edges, or events outside LEVEL_0.
    Flow abstraction may only reference recorded node_ids / handler entries.
    """
    validate_level_0_integrity(trace)
    recorded_nodes = {
        e.node_id for e in trace.events if e.node_id
    }
    recorded_targets = {
        e.detail.get("target")
        for e in trace.events
        if e.detail.get("target")
    }
    allowed_nodes = recorded_nodes | recorded_targets

    flow = doc.get("flow") or []
    for step in flow:
        nid = step.get("node_id")
        if nid and nid not in allowed_nodes:
            raise SemanticFirewallError(
                f"view introduced unknown node_id {nid!r} (not in LEVEL_0)"
            )
        entry = step.get("entry")
        if entry and entry not in allowed_nodes:
            raise SemanticFirewallError(
                f"view introduced unknown handler entry {entry!r}"
            )

    segments = doc.get("segments") or []
    for seg in segments:
        nid = seg.get("node_id")
        if nid and nid not in allowed_nodes:
            raise SemanticFirewallError(
                f"compressed view segment references unknown node {nid!r}"
            )


def validate_overlay_annotation_only(
    overlay_summary: Mapping[str, Any],
    trace: ExecutionTrace,
) -> None:
    """Overlay must not claim nodes absent from LEVEL_0."""
    validate_level_0_integrity(trace)
    recorded = {e.node_id for e in trace.events if e.node_id}
    for item in overlay_summary.get("slow_branches", []):
        for key in ("from", "to"):
            nid = item.get(key)
            if nid and nid not in recorded:
                raise SemanticFirewallError(f"overlay references unknown node {nid!r}")
    for item in overlay_summary.get("hot_paths", []):
        for nid in item.get("nodes", []):
            if nid and nid not in recorded:
                raise SemanticFirewallError(f"overlay hot path unknown node {nid!r}")


def validate_diff_preserves_inputs(a: ExecutionTrace, b: ExecutionTrace) -> None:
    """Diff is read-only — inputs must remain byte-for-byte equivalent in memory."""
    sig_a_before = equivalence_signature(a)
    sig_b_before = equivalence_signature(b)
    from cicada_platform.debug.trace_diff import diff_traces

    diff_traces(a, b)
    if equivalence_signature(a) != sig_a_before:
        raise SemanticFirewallError("diff mutated trace A equivalence class")
    if equivalence_signature(b) != sig_b_before:
        raise SemanticFirewallError("diff mutated trace B equivalence class")


def _frozen_detail(detail: dict[str, Any]) -> tuple[tuple[str, str], ...]:
    return tuple(sorted((str(k), repr(v)) for k, v in detail.items()))
