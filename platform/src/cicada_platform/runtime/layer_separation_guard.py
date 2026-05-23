"""Layer separation enforcement — execution / trace / intelligence boundaries."""

from __future__ import annotations

import ast
from pathlib import Path

_PKG = Path(__file__).resolve().parent.parent

EXECUTION_DIRS = (
    _PKG / "runtime" / "control_plane",
    _PKG / "runtime" / "native_core",
    _PKG / "runtime" / "ops",
)

EXECUTION_FILES = (
    _PKG / "runtime" / "graph_engine.py",
    _PKG / "runtime" / "services.py",
    _PKG / "runtime" / "entry.py",
    _PKG / "runtime" / "scenario.py",
)

TRACE_FILE = _PKG / "runtime" / "trace.py"
INTELLIGENCE_DIR = _PKG / "debug"

# Intelligence modules — forbidden in execution (except allowlist).
FORBIDDEN_INTELLIGENCE_IMPORTS = frozenset(
    {
        "cicada_platform.debug.trace_compression",
        "cicada_platform.debug.trace_view",
        "cicada_platform.debug.trace_inspector",
        "cicada_platform.debug.replay",
        "cicada_platform.debug.performance_overlay",
        "cicada_platform.debug.trace_diff",
        "cicada_platform.debug.profiler",
        "cicada_platform.debug.install",
        "cicada_platform.debug.hooks",
    }
)

# Single allowlisted delegate: export_trace facade only.
ALLOWED_EXECUTION_INTELLIGENCE_IMPORTS: dict[str, frozenset[str]] = {
    "runtime/control_plane/graph_control_plane.py": frozenset(
        {"cicada_platform.debug.trace_export"}
    ),
}

# Trace plane must not import intelligence or execution orchestration.
FORBIDDEN_TRACE_IMPORT_PREFIXES = (
    "cicada_platform.debug",
    "cicada_platform.runtime.control_plane",
    "cicada_platform.runtime.native_core",
    "cicada_platform.runtime.ops",
    "cicada_platform.runtime.graph_engine",
)

# Intelligence must not drive execution.
FORBIDDEN_INTELLIGENCE_IMPORT_PREFIXES = (
    "cicada_platform.runtime.control_plane",
    "cicada_platform.runtime.native_core",
    "cicada_platform.runtime.ops.registry",
    "cicada_platform.runtime.graph_engine",
    "cicada_platform.runtime.services",
)

REPLAY_LEVEL_0_ONLY = True


def _iter_py_files(*roots: Path) -> list[Path]:
    out: list[Path] = []
    for root in roots:
        if root.is_file():
            out.append(root)
        else:
            out.extend(p for p in root.rglob("*.py") if p.name != "__pycache__")
    return out


def _imports_in_file(path: Path) -> list[tuple[int, str]]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    found: list[tuple[int, str]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                found.append((node.lineno, alias.name))
        elif isinstance(node, ast.ImportFrom) and node.module:
            found.append((node.lineno, node.module))
    return found


def _rel(path: Path) -> str:
    try:
        return path.relative_to(_PKG).as_posix()
    except ValueError:
        return path.as_posix()


def execution_imports_intelligence() -> list[str]:
    violations: list[str] = []
    files = []
    for d in EXECUTION_DIRS:
        files.extend(_iter_py_files(d))
    files.extend(_iter_py_files(*EXECUTION_FILES))
    for path in files:
        rel = _rel(path)
        allowed = ALLOWED_EXECUTION_INTELLIGENCE_IMPORTS.get(rel, frozenset())
        for lineno, mod in _imports_in_file(path):
            if not mod.startswith("cicada_platform.debug"):
                continue
            if mod in allowed:
                continue
            violations.append(f"{rel}:{lineno} imports {mod} (not allowlisted)")
    return violations


def trace_layer_import_violations() -> list[str]:
    violations: list[str] = []
    for lineno, mod in _imports_in_file(TRACE_FILE):
        for prefix in FORBIDDEN_TRACE_IMPORT_PREFIXES:
            if mod.startswith(prefix):
                violations.append(f"runtime/trace.py:{lineno} imports {mod}")
    text = TRACE_FILE.read_text(encoding="utf-8")
    if "cicada_platform.debug" in text:
        violations.append("runtime/trace.py: must not reference cicada_platform.debug")
    return violations


def intelligence_imports_execution() -> list[str]:
    violations: list[str] = []
    for path in _iter_py_files(INTELLIGENCE_DIR):
        rel = _rel(path)
        for lineno, mod in _imports_in_file(path):
            for prefix in FORBIDDEN_INTELLIGENCE_IMPORT_PREFIXES:
                if mod.startswith(prefix):
                    violations.append(f"{rel}:{lineno} imports {mod}")
    return violations


def collect_layer_violations() -> list[str]:
    return (
        execution_imports_intelligence()
        + trace_layer_import_violations()
        + intelligence_imports_execution()
    )


def assert_layer_separation_clean() -> None:
    violations = collect_layer_violations()
    if violations:
        raise AssertionError(
            "Layer separation violations:\n" + "\n".join(violations)
        )
