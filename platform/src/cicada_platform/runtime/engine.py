"""Runtime facade — GraphExecutionEngine is the entry point."""

from __future__ import annotations

from typing import Any

from cicada_platform.core.schemas.ir_graph import IrProgramGraph
from cicada_platform.runtime.graph_engine import GraphExecutionEngine


class RuntimeEngine(GraphExecutionEngine):
    """Alias for bootstrap/API; executes IrProgramGraph only (not raw DSL)."""

    def __init__(self, graph: IrProgramGraph, program: object, tg: Any, **kw: Any) -> None:
        super().__init__(graph, program, tg, **kw)
