"""Explicit graph traversal failures (no silent break/continue on bad nodes)."""

from __future__ import annotations

from typing import Any


class GraphTraversalNodeError(RuntimeError):
    """Raised when traversal hits a missing or invalid graph node."""

    def __init__(
        self,
        message: str,
        *,
        node_id: str,
        node_type: str | None,
        execution_path: list[str],
        reason: str,
    ) -> None:
        self.node_id = node_id
        self.node_type = node_type
        self.execution_path = list(execution_path)
        self.reason = reason
        super().__init__(message)

    def as_dict(self) -> dict[str, Any]:
        return {
            "node_id": self.node_id,
            "node_type": self.node_type,
            "execution_path": self.execution_path,
            "reason": self.reason,
            "message": str(self),
        }

    @staticmethod
    def _format_path(execution_path: list[str]) -> str:
        return " → ".join(execution_path) if execution_path else "(empty)"

    @classmethod
    def missing_node(cls, node_id: str, execution_path: list[str]) -> GraphTraversalNodeError:
        path_repr = cls._format_path(execution_path)
        return cls(
            (
                f"Graph node {node_id!r} is missing "
                f"(node_id={node_id!r}, node_type=None, execution_path={path_repr})"
            ),
            node_id=node_id,
            node_type=None,
            execution_path=execution_path,
            reason="missing_node",
        )

    @classmethod
    def invalid_node(
        cls,
        node_id: str,
        node_type: str | None,
        execution_path: list[str],
        *,
        detail: str,
    ) -> GraphTraversalNodeError:
        path_repr = cls._format_path(execution_path)
        type_repr = node_type if node_type is not None else "?"
        return cls(
            (
                f"Graph node {node_id!r} is invalid: {detail} "
                f"(node_id={node_id!r}, node_type={type_repr!r}, execution_path={path_repr})"
            ),
            node_id=node_id,
            node_type=node_type,
            execution_path=execution_path,
            reason="invalid_node",
        )

    @classmethod
    def missing_block(
        cls,
        block_ref: str,
        block_name: str,
        execution_path: list[str],
    ) -> GraphTraversalNodeError:
        path_repr = cls._format_path(execution_path)
        return cls(
            (
                f"Block {block_name!r} is missing "
                f"(node_id={block_ref!r}, node_type='block', execution_path={path_repr})"
            ),
            node_id=block_ref,
            node_type="block",
            execution_path=execution_path,
            reason="missing_block",
        )

    @classmethod
    def missing_edge(
        cls,
        node_id: str,
        node_type: str,
        execution_path: list[str],
        *,
        edge_kind: str,
    ) -> GraphTraversalNodeError:
        path_repr = cls._format_path(execution_path)
        return cls(
            (
                f"Required {edge_kind!r} edge missing from node {node_id!r} "
                f"(node_id={node_id!r}, node_type={node_type!r}, execution_path={path_repr})"
            ),
            node_id=node_id,
            node_type=node_type,
            execution_path=execution_path,
            reason="missing_edge",
        )

    @classmethod
    def step_limit_exceeded(
        cls,
        node_id: str,
        execution_path: list[str],
        *,
        limit: int,
    ) -> GraphTraversalNodeError:
        path_repr = cls._format_path(execution_path)
        return cls(
            (
                f"Graph traversal exceeded {limit} steps at {node_id!r} "
                f"(node_id={node_id!r}, node_type=None, execution_path={path_repr})"
            ),
            node_id=node_id,
            node_type=None,
            execution_path=execution_path,
            reason="step_limit_exceeded",
        )
