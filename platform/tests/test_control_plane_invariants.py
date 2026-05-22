"""Control-plane invariants: module size and import DAG."""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

CONTROL_PLANE_DIR = (
    Path(__file__).resolve().parents[1]
    / "src"
    / "cicada_platform"
    / "runtime"
    / "control_plane"
)

MAX_LINES = 300

SUB_ENGINE_MODULES = frozenset(
    {
        "graph_router.py",
        "graph_traversal.py",
        "graph_scenarios.py",
        "graph_resume.py",
        "graph_scheduler.py",
        "graph_control_plane.py",
    }
)


def _line_count(path: Path) -> int:
    return len(path.read_text(encoding="utf-8").splitlines())


def _local_imports(path: Path) -> set[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    mods: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module:
            if "cicada_platform.runtime.control_plane" in node.module:
                mods.add(node.module.split(".")[-1])
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name.startswith("cicada_platform.runtime.control_plane"):
                    mods.add(alias.name.split(".")[-1])
    return mods


def test_control_plane_submodules_under_line_limit():
    for name in SUB_ENGINE_MODULES:
        path = CONTROL_PLANE_DIR / name
        assert path.exists(), f"missing {name}"
        lines = _line_count(path)
        assert lines <= MAX_LINES, f"{name} has {lines} lines (max {MAX_LINES})"


def test_control_plane_subengines_no_cross_import_cycles():
    """Sub-engines may only import protocol/context — not each other."""
    allowed = {"protocol", "context"}
    for name in SUB_ENGINE_MODULES:
        if name == "graph_control_plane.py":
            continue
        path = CONTROL_PLANE_DIR / name
        imports = _local_imports(path)
        forbidden = imports - allowed
        assert not forbidden, f"{name} imports other sub-engines: {forbidden}"


def test_graph_control_plane_imports_all_subengines():
    path = CONTROL_PLANE_DIR / "graph_control_plane.py"
    imports = _local_imports(path)
    assert "graph_router" in imports
    assert "graph_traversal" in imports
    assert "graph_scenarios" in imports
    assert "graph_resume" in imports
    assert "graph_scheduler" in imports
