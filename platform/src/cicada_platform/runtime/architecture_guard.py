"""Static guards: native_core = pure effects only (NO orchestration)."""

from __future__ import annotations

import ast
import re
from pathlib import Path

RULE_NATIVE_CORE_NO_ORCHESTRATION = "native_core = NO ORCHESTRATION (effects only)"

LEGACY_ORACLE_PATHS = frozenset(
    {
        "harness.py",
    }
)

FORBIDDEN_IN_NATIVE_CORE = re.compile(
    r"\b("
    r"_dispatch|_exec_body|_exec_|LegacyExecutor|Executor\.handle|"
    r"from cicada\.executor|import cicada\.executor|"
    r"LegacyStatementFallback|_start_scenario|_continue_scenario"
    r")\b",
    re.IGNORECASE,
)

# Graph / control-plane symbols must not appear in native_core
FORBIDDEN_GRAPH_IMPORTS = re.compile(
    r"\b("
    r"GraphExecutionEngine|graph_engine|IrProgramGraph|ir_graph|"
    r"GraphBuilder|graph_lowering|ScenarioGraphRunner|entry\.py"
    r")\b",
)

FORBIDDEN_GRAPH_TERMS = re.compile(
    r"\b("
    r"GraphExecutionEngine|IrProgramGraph|suspend_resume|EdgeKind|"
    r"entry_node|step_nodes|scenario FSM|_run_graph|handle_update"
    r")\b",
    re.IGNORECASE,
)

FORBIDDEN_ORCHESTRATION_TERMS = re.compile(
    r"\b(handler table|dispatch table|scenario FSM)\b",
    re.IGNORECASE,
)

RUNTIME_SCAN_DIRS = ("native_core", "ops/native", "ops/registry.py", "services.py")


def _platform_runtime_root() -> Path:
    return Path(__file__).resolve().parent


def scan_file(path: Path) -> list[str]:
    violations: list[str] = []
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return violations

    if path.name in LEGACY_ORACLE_PATHS:
        return violations

    in_native_core = "native_core" in path.parts

    if in_native_core or "ops" in path.parts:
        for m in FORBIDDEN_IN_NATIVE_CORE.finditer(text):
            violations.append(f"{path}: forbidden pattern {m.group(0)!r}")
        if in_native_core and path.suffix == ".py":
            for m in FORBIDDEN_GRAPH_IMPORTS.finditer(text):
                violations.append(f"{path}: graph/control-plane import {m.group(0)!r}")
            for m in FORBIDDEN_GRAPH_TERMS.finditer(text):
                violations.append(f"{path}: graph term {m.group(0)!r}")
            for m in FORBIDDEN_ORCHESTRATION_TERMS.finditer(text):
                violations.append(f"{path}: orchestration term {m.group(0)!r}")

    if path.name == "graph_engine.py":
        return violations

    if "runtime" in path.parts and path.suffix == ".py":
        if "from cicada.executor import" in text or "import cicada.executor" in text:
            if path.name not in LEGACY_ORACLE_PATHS:
                violations.append(f"{path}: imports cicada.executor outside oracle")

    return violations


def native_core_imports_graph_engine() -> list[str]:
    """AST check: native_core must not import GraphExecutionEngine or graph_engine."""
    root = _platform_runtime_root() / "native_core"
    violations: list[str] = []
    forbidden_modules = {
        "cicada_platform.runtime.graph_engine",
        "graph_engine",
    }
    forbidden_names = {"GraphExecutionEngine", "IrProgramGraph", "ScenarioGraphRunner"}

    for path in root.rglob("*.py"):
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"))
        except SyntaxError:
            continue
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    mod = alias.name
                    if mod in forbidden_modules or mod.endswith(".graph_engine"):
                        violations.append(f"{path}: imports {mod}")
            elif isinstance(node, ast.ImportFrom):
                mod = node.module or ""
                if mod in forbidden_modules or mod.endswith("graph_engine"):
                    violations.append(f"{path}: from {mod} import ...")
                if mod.endswith("ir_graph") or mod.endswith("graph_lowering"):
                    violations.append(f"{path}: from {mod} import ...")
                for alias in node.names:
                    if alias.name in forbidden_names:
                        violations.append(f"{path}: from {mod} import {alias.name}")
    return violations


def collect_violations() -> list[str]:
    root = _platform_runtime_root()
    out: list[str] = []
    for part in RUNTIME_SCAN_DIRS:
        target = root / part
        if target.is_file():
            out.extend(scan_file(target))
            continue
        if not target.is_dir():
            continue
        for path in target.rglob("*.py"):
            if path.name.startswith("test_"):
                continue
            out.extend(scan_file(path))
    out.extend(native_core_imports_graph_engine())
    return out


def assert_architecture_clean() -> None:
    violations = collect_violations()
    if violations:
        raise AssertionError(
            f"{RULE_NATIVE_CORE_NO_ORCHESTRATION}\n"
            + "Violations:\n"
            + "\n".join(violations[:50])
        )
