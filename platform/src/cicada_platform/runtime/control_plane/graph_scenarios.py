"""Scenario / subflow stepping via graph step nodes."""

from __future__ import annotations

from typing import Any

from cicada_platform.core.schemas.ir_graph import IrProgramGraph
from cicada_platform.runtime.control_plane.protocol import ControlPlaneHost


class GraphScenarios:
    """StartScenario, nested flows, step progression (no inbound routing)."""

    def __init__(self, host: ControlPlaneHost, graph: IrProgramGraph) -> None:
        self._host = host
        self._graph = graph

    def start(self, ctx: Any, name: str) -> None:
        if name not in self._graph.scenarios:
            from cicada_platform.runtime.native_core import CicadaRuntimeError

            raise CicadaRuntimeError(f"Сценарий '{name}' не найден")
        ctx.scenario = name
        ctx.step = 0
        ctx.current_step_name = None
        ctx._transition_made = False
        ctx._pending_stmts = []
        ctx.set_step_names([])
        self.continue_steps(ctx)

    def continue_steps(self, ctx: Any) -> None:
        if not ctx.scenario:
            return

        pending = getattr(ctx, "_pending_stmts", None)
        if pending:
            ctx._pending_stmts = []
            self._host.execute_statements(pending, ctx)
            if getattr(ctx, "waiting_for", None):
                return
            if ctx.scenario:
                self.continue_steps(ctx)
            return

        sc = self._graph.scenarios.get(ctx.scenario)
        if not sc:
            ctx.scenario = None
            return

        if ctx.step >= len(sc.step_nodes):
            ctx.scenario = None
            ctx.step = 0
            ctx.waiting_for = None
            ctx.current_step_name = None
            return

        if ctx.step < len(sc.step_nodes):
            step_node_id = sc.step_nodes[ctx.step]
            ctx.step += 1
            ctx._repeat_requested = False
            ctx._transition_made = False
            self._host.run_graph(step_node_id, ctx)

            if getattr(ctx, "_repeat_requested", False):
                ctx._repeat_requested = False
                self.continue_steps(ctx)
            elif getattr(ctx, "_transition_made", False):
                ctx._transition_made = False
                self.continue_steps(ctx)
            elif ctx.waiting_for is None:
                self.continue_steps(ctx)
