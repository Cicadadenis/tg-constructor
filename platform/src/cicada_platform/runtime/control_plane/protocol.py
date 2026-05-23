"""Control-plane host protocol — breaks import cycles between sub-engines."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Protocol

from cicada_platform.core.schemas.ir_graph import IrProgramGraph

if TYPE_CHECKING:
    from cicada_platform.runtime.control_plane.graph_resume import GraphResume
    from cicada_platform.runtime.control_plane.graph_scenarios import GraphScenarios
    from cicada_platform.runtime.control_plane.graph_traversal import GraphTraversal
from cicada_platform.runtime.eval_shim import EvalShim
from cicada_platform.runtime.ops.registry import NativeOpRegistry
from cicada_platform.runtime.services import RuntimeServices
from cicada_platform.runtime.trace import ExecutionTrace


class ControlPlaneHost(Protocol):
    graph: IrProgramGraph
    program: object
    tg: Any
    trace: ExecutionTrace
    services: RuntimeServices
    ops: NativeOpRegistry
    eval: EvalShim
    scenarios: GraphScenarios
    resume: GraphResume
    traversal: GraphTraversal

    def run_graph(self, start_node: str, ctx: Any) -> None: ...
    def run_entries(self, entry_nodes: list[str], ctx: Any) -> None: ...
    def execute_statements(self, stmts: list, ctx: Any) -> None: ...
    def before_each(self, ctx: Any) -> None: ...
    def after_each(self, ctx: Any) -> None: ...
