"""IR validation pipeline (DSL entry removed)."""

from __future__ import annotations

from dataclasses import dataclass

from cicada_platform.compiler.validate import compile_time_native_coverage_warnings, validate_graph
from cicada_platform.core.schemas.ast import AstProgramSnapshot
from cicada_platform.core.schemas.ir_graph import IrProgramGraph


@dataclass(frozen=True)
class CompileResult:
    ast: AstProgramSnapshot
    graph: IrProgramGraph
    diagnostics: list[str]

    @property
    def ir(self) -> IrProgramGraph:
        """Alias: IR execution source is the graph."""
        return self.graph


class CompilePipeline:
    def compile(self, dsl_source: str, *, base_path: str = ".") -> CompileResult:
        raise RuntimeError(
            "DSL compile path removed. Use compile_graph() with IR Graph JSON."
        )

    def compile_graph(self, graph_source: dict) -> CompileResult:
        graph = IrProgramGraph.model_validate(graph_source)
        ast = AstProgramSnapshot(
            config=dict(graph.config),
            handler_count=len(graph.handlers),
            scenario_count=len(graph.scenarios),
            block_count=len(graph.blocks),
            source_hash="",
        )
        diagnostics = list(validate_graph(graph))
        diagnostics.extend(compile_time_native_coverage_warnings())
        return CompileResult(ast=ast, graph=graph, diagnostics=diagnostics)
