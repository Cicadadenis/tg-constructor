"""Platform startup integrity checks."""

from __future__ import annotations

from cicada_platform.core.schemas.ir_graph import IrGraphNode, IrProgramGraph
from cicada_platform.startup_integrity import (
    run_startup_integrity_check,
    validate_compiled_graph,
    validate_native_op_registry,
)


def test_native_op_registry_aligned() -> None:
    assert validate_native_op_registry() == []


def test_static_startup_integrity_passes() -> None:
    result = run_startup_integrity_check()
    assert result.ok, result.violations


def test_compiled_graph_unknown_op() -> None:
    graph = IrProgramGraph(
        nodes={"n1": IrGraphNode(id="n1", op="NotARealOp", payload={})},
        edges=[],
    )
    violations = validate_compiled_graph(graph, label="probe")
    assert any(v.code == "unknown_node_op" for v in violations)
