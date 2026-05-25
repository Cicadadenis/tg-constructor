"""Startup integrity gate for the Python graph execution platform."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any

from cicada_platform.compiler.ops_manifest import GRAPH_CONTROL_OPS, LEGACY_OPS
from cicada_platform.core.schemas.ir_graph import IrGraphNode, IrProgramGraph
from cicada_platform.runtime.ops.native import GRAPH_ORCHESTRATED_OPS, NATIVE_OPS


@dataclass(frozen=True)
class IntegrityViolation:
    section: str
    code: str
    message: str
    details: dict[str, Any] = field(default_factory=dict)


@dataclass
class IntegrityResult:
    ok: bool
    violations: list[IntegrityViolation] = field(default_factory=list)
    sections: dict[str, int] = field(default_factory=dict)


def is_startup_integrity_enabled() -> bool:
    raw = os.environ.get("SKIP_STARTUP_INTEGRITY", "").strip().lower()
    return raw not in ("1", "true", "yes", "on")


def _violation(
    section: str,
    code: str,
    message: str,
    **details: Any,
) -> IntegrityViolation:
    return IntegrityViolation(section=section, code=code, message=message, details=details)


def validate_native_op_registry() -> list[IntegrityViolation]:
    violations: list[IntegrityViolation] = []
    native_keys = set(NATIVE_OPS.keys())
    orchestrated = set(GRAPH_ORCHESTRATED_OPS)

    for op in LEGACY_OPS:
        if op in orchestrated:
            continue
        if op not in native_keys:
            violations.append(
                _violation(
                    "node_types",
                    "missing_native_op",
                    f'Legacy op "{op}" is not registered in NATIVE_OPS',
                    op=op,
                ),
            )

    for op in native_keys:
        if op in orchestrated:
            continue
        if op not in LEGACY_OPS:
            violations.append(
                _violation(
                    "node_types",
                    "unmanifested_native_op",
                    f'Native op "{op}" is not listed in LEGACY_OPS manifest',
                    op=op,
                ),
            )

    for op in GRAPH_CONTROL_OPS:
        if op not in orchestrated:
            violations.append(
                _violation(
                    "node_types",
                    "control_op_not_orchestrated",
                    f'Control op "{op}" must be in GRAPH_ORCHESTRATED_OPS',
                    op=op,
                ),
            )

    return violations


def validate_graph_schemas() -> list[IntegrityViolation]:
    violations: list[IntegrityViolation] = []
    try:
        probe = IrProgramGraph(
            nodes={
                "n1": IrGraphNode(id="n1", op="Noop", payload={}),
            },
            edges=[],
            handlers=[],
        )
        if "n1" not in probe.nodes:
            violations.append(
                _violation(
                    "graph_schemas",
                    "ir_graph_probe_failed",
                    "IrProgramGraph probe did not retain nodes",
                ),
            )
    except Exception as exc:
        violations.append(
            _violation(
                "graph_schemas",
                "ir_graph_schema_invalid",
                f"IrProgramGraph schema validation failed: {exc}",
            ),
        )
    return violations


def validate_compiled_graph(graph: IrProgramGraph, *, label: str = "graph") -> list[IntegrityViolation]:
    violations: list[IntegrityViolation] = []
    known_ops = set(LEGACY_OPS) | {"Noop"}

    for node_id, node in graph.nodes.items():
        op = str(node.op or "").strip()
        if not op:
            violations.append(
                _violation(
                    "compiled_graphs",
                    "empty_node_op",
                    f'{label}: node "{node_id}" has empty op',
                    node_id=node_id,
                ),
            )
            continue
        if op not in known_ops:
            violations.append(
                _violation(
                    "compiled_graphs",
                    "unknown_node_op",
                    f'{label}: node "{node_id}" has unknown op "{op}"',
                    node_id=node_id,
                    node_type=op,
                ),
            )

    from cicada_platform.compiler.validate import validate_graph

    for msg in validate_graph(graph):
        violations.append(
            _violation(
                "compiled_graphs",
                "graph_structure_invalid",
                f"{label}: {msg}",
            ),
        )

    return violations


def run_startup_integrity_check() -> IntegrityResult:
    if not is_startup_integrity_enabled():
        return IntegrityResult(ok=True)

    violations = [
        *validate_native_op_registry(),
        *validate_graph_schemas(),
    ]

    sections: dict[str, int] = {}
    for v in violations:
        sections[v.section] = sections.get(v.section, 0) + 1

    return IntegrityResult(ok=len(violations) == 0, violations=violations, sections=sections)


def format_startup_integrity_report(result: IntegrityResult) -> str:
    lines = [
        "",
        "══════════════════════════════════════════════════════════════",
        "STARTUP INTEGRITY CHECK FAILED (platform)",
        "══════════════════════════════════════════════════════════════",
    ]
    if result.sections:
        lines.append("")
        lines.append("Summary by section:")
        for section, count in sorted(result.sections.items()):
            lines.append(f"  - {section}: {count}")

    by_section: dict[str, list[IntegrityViolation]] = {}
    for v in result.violations:
        by_section.setdefault(v.section, []).append(v)

    for section, items in sorted(by_section.items()):
        lines.append("")
        lines.append(f"[{section}] ({len(items)} violation(s))")
        for item in items:
            lines.append(f"  • [{item.code}] {item.message}")
            if item.details:
                lines.append(f"    {item.details}")

    lines.extend(
        [
            "",
            f"Total violations: {len(result.violations)}",
            "Startup blocked until integrity issues are resolved.",
            "Set SKIP_STARTUP_INTEGRITY=1 only for emergency local recovery.",
            "══════════════════════════════════════════════════════════════",
            "",
        ],
    )
    return "\n".join(lines)


def log_startup_integrity_report(result: IntegrityResult) -> str:
    import logging

    report = format_startup_integrity_report(result)
    logging.getLogger("cicada_platform.startup").error(report)
    return report
