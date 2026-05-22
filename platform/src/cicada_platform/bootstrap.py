"""Application bootstrap — wires DI, plugins, transports."""

from __future__ import annotations

from cicada_platform.core.di.container import Container
from cicada_platform.core.metrics.registry import MetricsRegistry
from cicada_platform.core.schemas.ir_graph import IrProgramGraph
from cicada_platform.runtime.graph_engine import GraphExecutionEngine


def build_runtime(
    graph: IrProgramGraph,
    tg,
) -> tuple[GraphExecutionEngine, Container]:
    container = Container()
    container.register_singleton("metrics", MetricsRegistry())
    engine = GraphExecutionEngine(graph, tg)
    return engine, container
