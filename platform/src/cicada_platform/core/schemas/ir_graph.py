"""Graph-based IR v2 — single execution source."""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class EdgeKind(StrEnum):
    NEXT = "next"
    TRUE = "true"
    FALSE = "false"
    LOOP_BODY = "loop_body"
    LOOP_EXIT = "loop_exit"
    LOOP_BACK = "loop_back"
    SCENARIO = "scenario"
    BLOCK = "block"
    SUSPEND_RESUME = "suspend_resume"
    JOIN = "join"


class IrGraphNode(BaseModel):
    id: str
    op: str
    payload: dict[str, Any] = Field(default_factory=dict)
    meta: dict[str, Any] = Field(default_factory=dict)


class IrGraphEdge(BaseModel):
    id: str
    source: str
    target: str
    kind: EdgeKind = EdgeKind.NEXT
    condition: str | None = None


class IrHandlerEntry(BaseModel):
    kind: str
    trigger: str | None = None
    entry_node: str
    priority: int = 100


class IrScenarioEntry(BaseModel):
    name: str
    entry_node: str
    step_nodes: list[str] = Field(default_factory=list)


class IrBlockEntry(BaseModel):
    name: str
    entry_node: str


class IrProgramGraph(BaseModel):
    schema_version: int = 2
    name: str = "bot"
    config: dict[str, Any] = Field(default_factory=dict)
    globals: dict[str, Any] = Field(default_factory=dict)
    nodes: dict[str, IrGraphNode] = Field(default_factory=dict)
    edges: list[IrGraphEdge] = Field(default_factory=list)
    handlers: list[IrHandlerEntry] = Field(default_factory=list)
    scenarios: dict[str, IrScenarioEntry] = Field(default_factory=dict)
    blocks: dict[str, IrBlockEntry] = Field(default_factory=dict)

    def outgoing(self, node_id: str, kind: EdgeKind | None = None) -> list[IrGraphEdge]:
        out = [e for e in self.edges if e.source == node_id]
        if kind is not None:
            out = [e for e in out if e.kind == kind]
        return sorted(out, key=lambda e: e.id)

    def single_target(self, node_id: str, kind: EdgeKind) -> str | None:
        edges = self.outgoing(node_id, kind)
        return edges[0].target if len(edges) == 1 else None
