"""DAG walk: node/edge execution, loops, blocks (no inbound routing)."""

from __future__ import annotations

from typing import Any

from cicada_platform.compiler.ast_serialize import deserialize_stmt
from cicada_platform.core.schemas.ir_graph import EdgeKind
from cicada_platform.runtime.control_plane.protocol import ControlPlaneHost
from cicada_platform.runtime.native_core import LoopBreak, LoopContinue
from cicada_platform.runtime.ops.registry import execute_node
from cicada_platform.runtime.trace import TraceEventKind


class GraphTraversal:
    """Only layer that invokes NativeOpRegistry for graph nodes."""

    def __init__(self, host: ControlPlaneHost) -> None:
        self._host = host

    def run_native_op(self, op: str, payload: dict, ctx: Any) -> None:
        """Registry entry point (graph nodes and resume replay)."""
        self._host.ops.execute(op, payload, ctx)

    def run(self, start_node: str, ctx: Any) -> None:
        host = self._host
        current: str | None = start_node
        steps = 0
        while current and steps < 10_000:
            steps += 1

            if current.startswith("scenario:"):
                name = current.split(":", 1)[1]
                host.scenarios.start(ctx, name)
                return

            if current.startswith("block:"):
                name = current.split(":", 1)[1]
                be = host.graph.blocks.get(name)
                if be:
                    self.run(be.entry_node, ctx)
                return

            node = host.graph.nodes.get(current)
            if not node:
                break

            host.trace.emit(TraceEventKind.NODE_ENTER, node_id=current, op=node.op)

            if node.op == "Noop":
                host.trace.emit(TraceEventKind.NODE_EXIT, node_id=current, op=node.op)
                current = host.graph.single_target(current, EdgeKind.NEXT)
                continue

            if node.op == "If":
                current = self._branch_if(host, current, node, ctx)
                continue

            if node.op == "ForEach":
                self._run_foreach(node, ctx)
                host.trace.emit(TraceEventKind.NODE_EXIT, node_id=current, op=node.op)
                current = host.graph.single_target(current, EdgeKind.LOOP_EXIT)
                continue

            if node.op == "WhileLoop":
                self._run_while(node, ctx)
                host.trace.emit(TraceEventKind.NODE_EXIT, node_id=current, op=node.op)
                current = host.graph.single_target(current, EdgeKind.LOOP_EXIT)
                continue

            if node.op == "StartScenario":
                stmt = deserialize_stmt(node.payload)
                host.scenarios.start(ctx, stmt.name)
                return

            current = self._run_op_node(host, current, node, ctx)

        host.services.flush(ctx)

    def _branch_if(self, host: ControlPlaneHost, current: str, node: Any, ctx: Any) -> str | None:
        stmt = deserialize_stmt(node.payload)
        cond = host.eval.eval_condition(stmt.condition, ctx)
        host.trace.emit(TraceEventKind.CONDITION_EVALUATED, node_id=current, result=cond)
        kind = EdgeKind.TRUE if cond else EdgeKind.FALSE
        nxt = host.graph.single_target(current, kind)
        host.trace.emit(
            TraceEventKind.TRANSITION_TAKEN,
            node_id=current,
            edge=kind.value,
            target=nxt,
        )
        host.trace.emit(TraceEventKind.NODE_EXIT, node_id=current, op=node.op)
        return nxt

    def _run_op_node(self, host: ControlPlaneHost, current: str, node: Any, ctx: Any) -> str | None:
        try:
            execute_node(host, node, ctx)
            host.trace.emit(TraceEventKind.ACTION_EXECUTED, node_id=current, op=node.op)
        except Exception as exc:
            host.trace.emit(
                TraceEventKind.ERROR_EVENT,
                node_id=current,
                op=node.op,
                error=str(exc),
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

    def _run_foreach(self, node: Any, ctx: Any) -> None:
        host = self._host
        stmt = deserialize_stmt(node.payload)
        iterable = host.eval.eval(stmt.collection, ctx)
        if not isinstance(iterable, (list, str, dict)):
            return
        items = list(iterable.keys()) if isinstance(iterable, dict) else iterable
        body_entry = host.graph.single_target(node.id, EdgeKind.LOOP_BODY)
        if not body_entry:
            return
        for item in items:
            ctx.set(stmt.variable, item)
            try:
                self.run(body_entry, ctx)
            except LoopBreak:
                break
            except LoopContinue:
                continue

    def _run_while(self, node: Any, ctx: Any) -> None:
        host = self._host
        stmt = deserialize_stmt(node.payload)
        body_entry = host.graph.single_target(node.id, EdgeKind.LOOP_BODY)
        if not body_entry:
            return
        for _ in range(100_000):
            if not host.eval.eval_condition(stmt.condition, ctx):
                break
            try:
                self.run(body_entry, ctx)
            except LoopBreak:
                break
            except LoopContinue:
                continue
