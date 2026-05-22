"""GraphControlPlane — facade delegating to control-plane sub-engines."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from cicada_platform.core.schemas.ir_graph import IrProgramGraph
from cicada_platform.runtime.control_plane.graph_resume import GraphResume
from cicada_platform.runtime.control_plane.graph_router import GraphRouter
from cicada_platform.runtime.control_plane.graph_scenarios import GraphScenarios
from cicada_platform.runtime.control_plane.graph_scheduler import GraphScheduler
from cicada_platform.runtime.control_plane.graph_traversal import GraphTraversal
from cicada_platform.runtime.eval_shim import EvalShim
from cicada_platform.runtime.guard import assert_no_legacy_executor
from cicada_platform.runtime.ops.registry import NativeOpRegistry
from cicada_platform.runtime.services import RuntimeServices
from cicada_platform.runtime.config import is_exec_trace_mode
from cicada_platform.runtime.trace import ExecutionTrace, TraceEventKind


def _graph_runtime_program(graph: IrProgramGraph) -> Any:
    return SimpleNamespace(
        globals=dict(graph.globals or {}),
        handlers=[],
        scenarios={},
        blocks=dict(graph.blocks or {}),
    )


class GraphControlPlane:
    """Single entry point: routes inbound events, walks graph, resumes, scenarios."""

    def __init__(
        self,
        graph: IrProgramGraph,
        tg: Any,
        program: object | None = None,
        *,
        debug: bool = False,
    ) -> None:
        self.graph = graph
        self.program = program or _graph_runtime_program(graph)
        self.tg = tg
        self.trace = ExecutionTrace()
        self.services = RuntimeServices(self.program, tg, debug=debug)
        assert_no_legacy_executor(self.services.native, context="GraphControlPlane")
        self.ops = NativeOpRegistry(self.services)
        self.eval = EvalShim(self.services)

        self.traversal = GraphTraversal(self)
        self.scenarios = GraphScenarios(self, graph)
        self.resume = GraphResume(self)
        self.router = GraphRouter(self)
        self.scheduler = GraphScheduler(self)
        self._last_trace_export: dict | None = None

    @property
    def effects(self) -> list:
        return list(self.services.effects)

    @property
    def last_execution_trace(self) -> dict | None:
        """Populated when CICADA_EXEC_TRACE_MODE=1."""
        return self._last_trace_export

    def handle_update(self, update: dict) -> list:
        self.trace = ExecutionTrace()
        self._last_trace_export = None
        self.services.native.effects = []
        kind = "callback_query" if "callback_query" in update else "message"
        self.trace.emit(TraceEventKind.EXECUTION_START, inbound_kind=kind)
        self.router.handle_update(update)
        self.trace.emit(TraceEventKind.EXECUTION_END, effect_count=len(self.effects))
        if is_exec_trace_mode():
            self._last_trace_export = self.export_trace()
        return self.effects

    def run_graph(self, start_node: str, ctx: Any) -> None:
        self.traversal.run(start_node, ctx)

    def run_entries(self, entry_nodes: list[str], ctx: Any) -> None:
        self.router.run_entries(entry_nodes, ctx)

    def before_each(self, ctx: Any) -> None:
        self.router.before_each(ctx)

    def after_each(self, ctx: Any) -> None:
        self.router.after_each(ctx)

    def execute_statements(self, stmts: list, ctx: Any) -> None:
        self.resume.execute_statements(stmts, ctx)

    def export_trace(self, trace_id: str | None = None) -> dict:
        """Observability export — does not alter execution semantics."""
        from cicada_platform.debug.trace_export import build_trace_export

        return build_trace_export(self.graph, self.trace, trace_id=trace_id)
