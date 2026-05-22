"""Enforce: no execution logic outside NativeRuntime + NativeOps; no legacy executor in runtime."""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from cicada_platform.runtime.architecture_guard import (
    RULE_NATIVE_CORE_NO_ORCHESTRATION,
    assert_architecture_clean,
    collect_violations,
    native_core_imports_graph_engine,
)

RUNTIME_ROOT = Path(__file__).resolve().parents[1] / "src" / "cicada_platform" / "runtime"

ALLOWED_EXECUTION_MODULES = frozenset(
    {
        "native_core/base.py",
        "native_core/messaging.py",
        "native_core/conditions.py",
        "native_core/flow_control.py",
        "native_core/storage.py",
        "native_core/async_actions.py",
        "ops/native/__init__.py",
        "ops/registry.py",
        "services.py",
        "graph_engine.py",
        "scenario.py",
        "entry.py",
        "trace.py",
        "eval_shim.py",
        "config.py",
        "guard.py",
    }
)


def test_no_legacy_executor_in_graph_runtime_path():
    violations = collect_violations()
    assert not violations, "\n".join(violations)


def test_architecture_guard_helper():
    assert_architecture_clean()


def test_native_core_must_not_import_graph_engine():
    violations = native_core_imports_graph_engine()
    assert not violations, (
        f"{RULE_NATIVE_CORE_NO_ORCHESTRATION}: native_core imported graph engine:\n"
        + "\n".join(violations)
    )


def test_async_actions_is_effect_only_module():
    path = RUNTIME_ROOT / "native_core" / "async_actions.py"
    text = path.read_text(encoding="utf-8")
    assert "graph_engine" not in text
    assert "IrProgramGraph" not in text
    assert "NO orchestration" in text


def test_native_core_has_no_transitional_runtime_py():
    assert not (RUNTIME_ROOT / "native_core" / "runtime.py").exists()
    assert not (RUNTIME_ROOT / "native_core" / "evaluator.py").exists()


def test_graph_control_plane_is_facade_with_subengines():
    cp = (
        Path(__file__).resolve().parents[1]
        / "src"
        / "cicada_platform"
        / "runtime"
        / "control_plane"
        / "graph_control_plane.py"
    )
    tree = ast.parse(cp.read_text(encoding="utf-8"))
    methods: list[str] = []
    for node in tree.body:
        if isinstance(node, ast.ClassDef) and node.name == "GraphControlPlane":
            methods = [
                n.name
                for n in node.body
                if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))
            ]
    assert "handle_update" in methods
    assert "run_graph" in methods
    assert "execute_statements" in methods
    text = cp.read_text(encoding="utf-8")
    assert "GraphRouter" in text
    assert "GraphTraversal" in text


def test_native_ops_registry_covers_effect_ops():
    from cicada_platform.runtime.ops.native import GRAPH_ORCHESTRATED_OPS, NATIVE_OPS
    from cicada_platform.compiler.ops_manifest import LEGACY_OPS

    assert set(LEGACY_OPS) <= set(NATIVE_OPS) | GRAPH_ORCHESTRATED_OPS


@pytest.mark.parametrize(
    "flag",
    ["CICADA_GRAPH_NATIVE_MODE", "CICADA_RUNTIME_STRICT"],
)
def test_production_flags_documented(monkeypatch, flag: str):
    monkeypatch.setenv(flag, "1")
    from cicada_platform.runtime.config import is_graph_native_mode, is_runtime_strict

    if flag.endswith("NATIVE_MODE"):
        assert is_graph_native_mode()
    else:
        assert is_runtime_strict()
