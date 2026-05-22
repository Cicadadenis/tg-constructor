"""Suspend/resume and ask/input continuation."""

from __future__ import annotations

from typing import Any

from cicada_platform.compiler.ast_serialize import serialize_stmt
from cicada_platform.runtime.control_plane.context import auto_cast
from cicada_platform.runtime.control_plane.protocol import ControlPlaneHost
from cicada_platform.runtime.trace import TraceEventKind


class GraphResume:
    def __init__(self, host: ControlPlaneHost) -> None:
        self._host = host

    def resume_input(self, ctx: Any, value: str) -> None:
        waiting = ctx.waiting_for
        ctx.set(waiting, auto_cast(value))
        ctx.waiting_for = None
        if ctx.scenario:
            self._host.trace.emit(
                TraceEventKind.RESUME,
                mode="scenario",
                waiting_for=waiting,
                value=value,
            )
            self._host.scenarios.continue_steps(ctx)
            return
        resume_node = getattr(ctx, "_graph_resume_node", None)
        if resume_node:
            ctx._graph_resume_node = None
            self._host.trace.emit(
                TraceEventKind.RESUME,
                mode="graph_node",
                target=resume_node,
                waiting_for=waiting,
                value=value,
            )
            self._host.run_graph(resume_node, ctx)
            return
        pending = getattr(ctx, "_pending_stmts", None)
        if pending:
            ctx._pending_stmts = []
            self._host.trace.emit(
                TraceEventKind.RESUME,
                mode="pending_statements",
                waiting_for=waiting,
                value=value,
                count=len(pending),
            )
            self.execute_statements(pending, ctx)

    def execute_statements(self, stmts: list, ctx: Any) -> None:
        host = self._host
        for stmt in stmts:
            op = type(stmt).__name__
            payload = serialize_stmt(stmt)
            host.traversal.run_native_op(op, payload, ctx)
            if getattr(ctx, "_return_requested", False):
                break
            if getattr(ctx, "waiting_for", None):
                break
        host.services.flush(ctx)
