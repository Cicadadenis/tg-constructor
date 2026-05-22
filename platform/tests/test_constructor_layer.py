"""Graph constructor layer — structural IR only, external execution API."""

from __future__ import annotations

import pytest

from cicada_platform.constructor.graph_ir_adapter import GraphIRAdapter, GraphIRValidationError
from cicada_platform.runtime.layer_separation_guard import collect_layer_violations


def test_graph_ir_adapter_crud():
    adapter = GraphIRAdapter()
    adapter.create_node("n1", "SendMessage", payload={"text": "hi"})
    adapter.create_edge("e1", "n1", "n1", kind="next")
    issues = adapter.validate_structure_only()
    assert issues == []


def test_delete_node_removes_edges():
    adapter = GraphIRAdapter()
    adapter.create_node("a", "Noop")
    adapter.create_node("b", "Noop")
    adapter.create_edge("e1", "a", "b")
    adapter.delete_node("a")
    assert all(e.source != "a" for e in adapter.graph.edges)


def test_unknown_node_raises():
    adapter = GraphIRAdapter()
    with pytest.raises(GraphIRValidationError):
        adapter.update_node("missing", op="X")


def test_constructor_package_no_execution_imports():
    violations = [
        v
        for v in collect_layer_violations()
        if "constructor" in v and "control_plane" in v
    ]
    assert violations == []
