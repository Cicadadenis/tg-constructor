"""Static validation for builder graphs."""

from __future__ import annotations

from cicada_platform.builder.graph import RuntimeGraph


def validate_graph(graph: RuntimeGraph) -> list[str]:
    errors: list[str] = []
    ids = {n.id for n in graph.nodes}
    if not graph.nodes:
        errors.append("graph: empty")
    for e in graph.edges:
        src = e.get("source")
        tgt = e.get("target")
        if src not in ids:
            errors.append(f"graph: unknown edge source {src!r}")
        if tgt not in ids:
            errors.append(f"graph: unknown edge target {tgt!r}")
    return errors
