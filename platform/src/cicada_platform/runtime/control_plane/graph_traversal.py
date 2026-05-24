"""DAG walk: node/edge execution, loops, blocks (no inbound routing)."""

from __future__ import annotations

from typing import Any

from cicada_platform.compiler.ast_serialize import deserialize_stmt
from cicada_platform.core.schemas.ir_graph import EdgeKind, IrGraphNode
from cicada_platform.runtime.control_plane.graph_traversal_errors import GraphTraversalNodeError
from cicada_platform.runtime.control_plane.protocol import ControlPlaneHost
from cicada_platform.runtime.native_core import LoopBreak, LoopContinue
from cicada_platform.runtime.ops.registry import execute_node
from cicada_platform.runtime.trace import TraceEventKind

_STEP_LIMIT = 10_000


class GraphTraversal:
    """Only layer that invokes NativeOpRegistry for graph nodes."""

    def __init__(self, host: ControlPlaneHost) -> None:
        self._host = host

    def run_native_op(self, op: str, payload: dict, ctx: Any) -> None:
        """Registry entry point (graph nodes and resume replay)."""
        self._host.ops.execute(op, payload, ctx)

    def run(self, start_node: str, ctx: Any, *, execution_path: list[str] | None = None) -> None:
        host = self._host
        path: list[str] = list(execution_path or [])
        current: str | None = start_node
        steps = 0
        while current:
            if steps >= _STEP_LIMIT:
                self._emit_and_raise(
                    GraphTraversalNodeError.step_limit_exceeded(
                        current,
                        path,
                        limit=_STEP_LIMIT,
                    ),
                )
            steps += 1

            if current.startswith("scenario:"):
                name = current.split(":", 1)[1]
                host.scenarios.start(ctx, name)
                return

            if current.startswith("block:"):
                name = current.split(":", 1)[1]
                be = host.graph.blocks.get(name)
                if not be:
                    self._emit_and_raise(
                        GraphTraversalNodeError.missing_block(current, name, path),
                    )
                child_path = path + [current]
                self.run(be.entry_node, ctx, execution_path=child_path)
                return

            node = self._require_node(host, current, path)
            path = path + [current]

            host.trace.emit(TraceEventKind.NODE_ENTER, node_id=current, op=node.op)

            if node.op == "Noop":
                host.trace.emit(TraceEventKind.NODE_EXIT, node_id=current, op=node.op)
                current = self._require_single_target(
                    host, current, node, path, EdgeKind.NEXT
                )
                continue

            if node.op == "If":
                current = self._branch_if(host, current, node, path, ctx)
                continue

            if node.op == "ForEach":
                self._run_foreach(node, path, ctx)
                host.trace.emit(TraceEventKind.NODE_EXIT, node_id=current, op=node.op)
                current = self._require_single_target(
                    host, current, node, path, EdgeKind.LOOP_EXIT
                )
                continue

            if node.op == "WhileLoop":
                self._run_while(node, path, ctx)
                host.trace.emit(TraceEventKind.NODE_EXIT, node_id=current, op=node.op)
                current = self._require_single_target(
                    host, current, node, path, EdgeKind.LOOP_EXIT
                )
                continue

            if node.op == "StartScenario":
                stmt = deserialize_stmt(node.payload)
                host.scenarios.start(ctx, stmt.name)
                return

            current = self._run_op_node(host, current, node, path, ctx)

        host.services.flush(ctx)

    def _require_node(
        self,
        host: ControlPlaneHost,
        node_id: str,
        execution_path: list[str],
    ) -> IrGraphNode:
        node = host.graph.nodes.get(node_id)
        if node is None:
            self._emit_and_raise(GraphTraversalNodeError.missing_node(node_id, execution_path))
        if not str(node.op or "").strip():
            self._emit_and_raise(
                GraphTraversalNodeError.invalid_node(
                    node_id,
                    node.op,
                    execution_path,
                    detail="op is empty",
                ),
            )
        if node.id != node_id:
            self._emit_and_raise(
                GraphTraversalNodeError.invalid_node(
                    node_id,
                    node.op,
                    execution_path,
                    detail=f"node.id {node.id!r} does not match graph key {node_id!r}",
                ),
            )
        return node

    def _require_single_target(
        self,
        host: ControlPlaneHost,
        node_id: str,
        node: IrGraphNode,
        execution_path: list[str],
        kind: EdgeKind,
    ) -> str | None:
        edges = host.graph.outgoing(node_id, kind)
        if len(edges) == 0:
            return None
        if len(edges) != 1:
            self._emit_and_raise(
                GraphTraversalNodeError.invalid_node(
                    node_id,
                    node.op,
                    execution_path,
                    detail=f"expected exactly one {kind.value} edge, found {len(edges)}",
                ),
            )
        target = edges[0].target
        if not str(target or "").strip():
            self._emit_and_raise(
                GraphTraversalNodeError.invalid_node(
                    node_id,
                    node.op,
                    execution_path,
                    detail=f"{kind.value} edge has empty target",
                ),
            )
        return target

    def _emit_and_raise(self, exc: GraphTraversalNodeError) -> None:
        host = self._host
        host.trace.emit(
            TraceEventKind.ERROR_EVENT,
            node_id=exc.node_id,
            op=exc.node_type,
            error=str(exc),
            reason=exc.reason,
            execution_path=exc.execution_path,
        )
        raise exc

    def _branch_if(
        self,
        host: ControlPlaneHost,
        current: str,
        node: IrGraphNode,
        execution_path: list[str],
        ctx: Any,
    ) -> str | None:
        stmt = deserialize_stmt(node.payload)
        cond = host.eval.eval_condition(stmt.condition, ctx)
        host.trace.emit(TraceEventKind.CONDITION_EVALUATED, node_id=current, result=cond)
        kind = EdgeKind.TRUE if cond else EdgeKind.FALSE
        nxt = self._require_single_target(host, current, node, execution_path, kind)
        host.trace.emit(
            TraceEventKind.TRANSITION_TAKEN,
            node_id=current,
            edge=kind.value,
            target=nxt,
        )
        host.trace.emit(TraceEventKind.NODE_EXIT, node_id=current, op=node.op)
        return nxt

    def _run_op_node(
        self,
        host: ControlPlaneHost,
        current: str,
        node: IrGraphNode,
        execution_path: list[str],
        ctx: Any,
    ) -> str | None:
        try:
            execute_node(host, node, ctx)
            host.trace.emit(TraceEventKind.ACTION_EXECUTED, node_id=current, op=node.op)
        except GraphTraversalNodeError:
            raise
        except Exception as exc:
            host.trace.emit(
                TraceEventKind.ERROR_EVENT,
                node_id=current,
                op=node.op,
                error=str(exc),
                execution_path=execution_path,
            )
            raise

        host.trace.emit(TraceEventKind.NODE_EXIT, node_id=current, op=node.op)

        if node.meta.get("suspend") or node.op == "Ask":
            if getattr(ctx, "waiting_for", None):
                host.trace.emit(
                    TraceEventKind.SUSPEND,
                    node_id=current,
                    waiting_for=ctx.waiting_for,
                )
                resume = host.graph.single_target(current, EdgeKind.SUSPEND_RESUME)
                if resume:
                    ctx._graph_resume_node = resume
                return None

        if getattr(ctx, "_return_requested", False):
            return None

        nxt = host.graph.single_target(current, EdgeKind.NEXT)
        if nxt:
            host.trace.emit(
                TraceEventKind.TRANSITION_TAKEN,
                node_id=current,
                edge=EdgeKind.NEXT.value,
                target=nxt,
            )
        return nxt

    def _run_foreach(self, node: IrGraphNode, execution_path: list[str], ctx: Any) -> None:
        host = self._host
        stmt = deserialize_stmt(node.payload)
        iterable = host.eval.eval(stmt.collection, ctx)
        if not isinstance(iterable, (list, str, dict)):
            self._emit_and_raise(
                GraphTraversalNodeError.invalid_node(
                    node.id,
                    node.op,
                    execution_path,
                    detail=f"collection must be list, str, or dict, got {type(iterable).__name__}",
                ),
            )
        items = list(iterable.keys()) if isinstance(iterable, dict) else iterable
        body_entry = self._require_single_target(
            host, node.id, node, execution_path, EdgeKind.LOOP_BODY
        )
        if not body_entry:
            self._emit_and_raise(
                GraphTraversalNodeError.missing_edge(
                    node.id,
                    node.op,
                    execution_path,
                    edge_kind=EdgeKind.LOOP_BODY.value,
                ),
            )
        loop_path = execution_path + [node.id]
        for item in items:
            ctx.set(stmt.variable, item)
            try:
                self.run(body_entry, ctx, execution_path=loop_path)
            except LoopBreak:
                break
            except LoopContinue:
                continue

    def _run_while(self, node: IrGraphNode, execution_path: list[str], ctx: Any) -> None:
        host = self._host
        stmt = deserialize_stmt(node.payload)
        body_entry = self._require_single_target(
            host, node.id, node, execution_path, EdgeKind.LOOP_BODY
        )
        if not body_entry:
            self._emit_and_raise(
                GraphTraversalNodeError.missing_edge(
                    node.id,
                    node.op,
                    execution_path,
                    edge_kind=EdgeKind.LOOP_BODY.value,
                ),
            )
        loop_path = execution_path + [node.id]
        for _ in range(100_000):
            if not host.eval.eval_condition(stmt.condition, ctx):
                break
            try:
                self.run(body_entry, ctx, execution_path=loop_path)
            except LoopBreak:
                break
            except LoopContinue:
                continue
