"""
GraphIRAdapter — structural authoring over IrProgramGraph.

No NativeOps, no GraphControlPlane, no execution semantics.
"""

from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from cicada_platform.core.schemas.ir_graph import IrGraphEdge, IrGraphNode, IrProgramGraph


class GraphIRValidationError(ValueError):
    pass


class GraphIRAdapter:
    """Authoring-time Graph IR mutations with structure-only validation."""

    def __init__(self, graph: IrProgramGraph | dict | None = None) -> None:
        if graph is None:
            self._graph = IrProgramGraph()
        elif isinstance(graph, IrProgramGraph):
            self._graph = graph.model_copy(deep=True)
        else:
            self._graph = IrProgramGraph.model_validate(graph)

    @property
    def graph(self) -> IrProgramGraph:
        return self._graph

    def to_dict(self) -> dict[str, Any]:
        return self._graph.model_dump()

    def create_node(
        self,
        node_id: str,
        op: str,
        *,
        payload: dict[str, Any] | None = None,
        meta: dict[str, Any] | None = None,
    ) -> IrGraphNode:
        if node_id in self._graph.nodes:
            raise GraphIRValidationError(f"node already exists: {node_id!r}")
        node = IrGraphNode(
            id=node_id,
            op=op,
            payload=payload or {},
            meta=meta or {},
        )
        self._graph.nodes[node_id] = node
        return node

    def update_node(
        self,
        node_id: str,
        *,
        op: str | None = None,
        payload: dict[str, Any] | None = None,
        meta: dict[str, Any] | None = None,
    ) -> IrGraphNode:
        node = self._graph.nodes.get(node_id)
        if not node:
            raise GraphIRValidationError(f"unknown node: {node_id!r}")
        if op is not None:
            node.op = op
        if payload is not None:
            node.payload = payload
        if meta is not None:
            node.meta = meta
        return node

    def delete_node(self, node_id: str) -> None:
        if node_id not in self._graph.nodes:
            raise GraphIRValidationError(f"unknown node: {node_id!r}")
        del self._graph.nodes[node_id]
        self._graph.edges = [e for e in self._graph.edges if e.source != node_id and e.target != node_id]

    def create_edge(
        self,
        edge_id: str,
        source: str,
        target: str,
        *,
        kind: str = "next",
        condition: str | None = None,
    ) -> IrGraphEdge:
        if source not in self._graph.nodes or target not in self._graph.nodes:
            raise GraphIRValidationError("edge endpoints must exist")
        edge = IrGraphEdge(id=edge_id, source=source, target=target, kind=kind, condition=condition)
        self._graph.edges.append(edge)
        return edge

    def validate_structure_only(self) -> list[str]:
        """Structural checks only — no execution, no NativeOp dispatch."""
        issues: list[str] = []
        try:
            IrProgramGraph.model_validate(self._graph.model_dump())
        except ValidationError as e:
            issues.append(f"schema: {e}")
            return issues

        node_ids = set(self._graph.nodes)
        for e in self._graph.edges:
            if e.source not in node_ids:
                issues.append(f"edge {e.id}: missing source {e.source!r}")
            if e.target not in node_ids:
                issues.append(f"edge {e.id}: missing target {e.target!r}")

        for hid, h in enumerate(self._graph.handlers):
            if h.entry_node and h.entry_node not in node_ids:
                issues.append(f"handler[{hid}]: unknown entry_node {h.entry_node!r}")

        for name, sc in self._graph.scenarios.items():
            if sc.entry_node not in node_ids:
                issues.append(f"scenario {name!r}: unknown entry_node")

        return issues
