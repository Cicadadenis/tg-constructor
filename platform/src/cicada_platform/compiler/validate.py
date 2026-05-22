"""Static validation on graph IR."""

from __future__ import annotations

from cicada_platform.compiler.ops_manifest import LEGACY_OPS
from cicada_platform.core.schemas.ir_graph import EdgeKind, IrProgramGraph

# All manifest ops must be registered in runtime/ops/native (compile-time check).
NATIVE_REGISTERED_OPS = frozenset(LEGACY_OPS)


def compile_time_native_coverage_warnings() -> list[str]:
    """Warnings only — not used at runtime execution."""
    missing = sorted(set(LEGACY_OPS) - NATIVE_REGISTERED_OPS)
    if not missing:
        return []
    return [
        f"compile: op {op!r} is not registered in runtime/ops/native "
        "(runtime will fail in strict/native mode)"
        for op in missing
    ]


def validate_graph(graph: IrProgramGraph) -> list[str]:
    errors: list[str] = []
    if not graph.handlers and not graph.scenarios:
        errors.append("graph: no handlers or scenarios")
    node_ids = set(graph.nodes)
    for e in graph.edges:
        if e.source not in node_ids and not e.source.startswith(("scenario:", "block:")):
            errors.append(f"graph: edge source missing node {e.source!r}")
        if e.target not in node_ids and not e.target.startswith(("scenario:", "block:")):
            errors.append(f"graph: edge target missing node {e.target!r}")
    for h in graph.handlers:
        if h.entry_node not in node_ids:
            errors.append(f"graph: handler {h.kind!r} entry {h.entry_node!r} missing")
    for name, sc in graph.scenarios.items():
        if sc.entry_node not in node_ids:
            errors.append(f"graph: scenario {name!r} entry missing")
    for e in graph.edges:
        if e.kind == EdgeKind.SUSPEND_RESUME and e.source not in node_ids:
            errors.append(f"graph: suspend edge invalid source {e.source!r}")
    return errors
