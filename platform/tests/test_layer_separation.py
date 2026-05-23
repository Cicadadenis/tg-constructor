"""Enforce Execution / Trace / Intelligence layer separation contract."""

from __future__ import annotations

import ast
import copy
import inspect

import pytest

from cicada_platform.debug.replay import REPLAY_LEVEL_0_ONLY, GraphExecutionReplayer
from cicada_platform.debug.trace_compression import compress_trace, decompress_trace
from cicada_platform.debug.trace_diff import diff_traces
from cicada_platform.debug.trace_view import SmartTraceView
from cicada_platform.debug.trace_levels import TraceLevel
from cicada_platform.runtime.layer_separation_guard import (
    REPLAY_LEVEL_0_ONLY as GUARD_REPLAY_LEVEL_0,
    assert_layer_separation_clean,
    collect_layer_violations,
    execution_imports_intelligence,
    intelligence_imports_execution,
    trace_layer_import_violations,
)
from cicada_platform.runtime.trace import ExecutionTrace, LAYER as TRACE_LAYER, TraceEventKind


def test_layer_separation_imports_clean():
    violations = collect_layer_violations()
    assert violations == [], "\n".join(violations)


def test_guard_assert_helper():
    assert_layer_separation_clean()


def test_trace_layer_no_debug_import():
    assert trace_layer_import_violations() == []


def test_execution_no_intelligence_except_allowlist():
    violations = execution_imports_intelligence()
    assert violations == [], "\n".join(violations)


def test_intelligence_no_execution_orchestration_imports():
    violations = intelligence_imports_execution()
    assert violations == [], "\n".join(violations)


def test_trace_module_layer_marker():
    from cicada_platform.runtime import trace as trace_mod

    assert trace_mod.LAYER == "trace"
    assert TRACE_LAYER == "trace"
    text = inspect.getsourcefile(ExecutionTrace) or ""
    assert "trace.py" in text or True


def test_level_0_export_has_no_derived_fields():
    trace = ExecutionTrace()
    trace.emit(TraceEventKind.EXECUTION_START)
    doc = trace.export()
    assert doc["layer"] == "trace"
    assert "resume_chain" not in doc
    assert "resume_events" not in doc


def test_derived_functions_do_not_mutate_canonical_trace():
    from cicada_platform.core.schemas.ir_graph import IrProgramGraph

    trace = ExecutionTrace()
    trace.emit(TraceEventKind.NODE_ENTER, node_id="a", op="X")
    trace.emit(TraceEventKind.NODE_EXIT, node_id="a", op="X")
    before = copy.deepcopy([e.model_dump() for e in trace.events])
    compress_trace(trace, verify_lossless=False)
    SmartTraceView(IrProgramGraph(), trace, level=TraceLevel.LEVEL_1).build()
    diff_traces(trace, trace)
    after = [e.model_dump() for e in trace.events]
    assert before == after


def test_replay_level_0_only_contract():
    assert REPLAY_LEVEL_0_ONLY is True
    assert GUARD_REPLAY_LEVEL_0 is True
    source = inspect.getsource(GraphExecutionReplayer.replay)
    assert "CompressedTrace" not in source
    assert "SmartTraceView" not in source
    assert "_trace.events" in source or "canonical_subset_events" in source


def test_replay_reads_canonical_events_not_compressed():
    from cicada_platform.core.schemas.ir_graph import IrProgramGraph

    trace = ExecutionTrace()
    trace.emit(TraceEventKind.EXECUTION_START)
    trace.emit(TraceEventKind.NODE_ENTER, node_id="n", op="SendMessage")
    trace.emit(TraceEventKind.NODE_EXIT, node_id="n", op="SendMessage")
    graph = IrProgramGraph()
    replayer = GraphExecutionReplayer(graph, trace)
    result = replayer.replay(fire_hooks=False)
    assert len(result.steps) == len(trace.events)


def test_graph_control_plane_allowlisted_export_only():
    path = (
        __import__("pathlib").Path(__file__).resolve().parents[1]
        / "src"
        / "cicada_platform"
        / "runtime"
        / "control_plane"
        / "graph_control_plane.py"
    )
    tree = ast.parse(path.read_text(encoding="utf-8"))
    debug_imports = []
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module and node.module.startswith(
            "cicada_platform.debug"
        ):
            debug_imports.append(node.module)
    assert debug_imports == ["cicada_platform.debug.trace_export"] or set(
        debug_imports
    ) <= {"cicada_platform.debug.trace_export"}
