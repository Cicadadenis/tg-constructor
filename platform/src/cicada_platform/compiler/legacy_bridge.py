"""
Legacy DSL bridge — SAFE STUB.

Background
----------
The DSL → AST compile path was removed when the project switched to an
IR-only architecture (see ROOT_CAUSE_ANALYSIS.md, GRAPH_ARCHITECTURE.md).
The Studio (`src/`) emits Python directly from `GraphDocument` via
`core/codegen`, and the platform API exposes structural validation +
external execution under `/v1/constructor/graph/*`.

Several legacy unit tests, parity harnesses, and external integrations
still try to:

    from cicada_platform.compiler.legacy_bridge import parse_dsl, ensure_legacy_path

Without this module those imports raise `ImportError` at module load
time, taking the whole test process down. That is the regression the
task brief refers to as "parse_dsl is a stub and breaks compilation".

This module restores the import surface as an **explicit, structured
deprecation shim**:

* ``parse_dsl(source)`` returns a deterministic ``DslCompileResult``
  describing the IR-only migration. It never crashes.
* ``ensure_legacy_path()`` is a no-op. The legacy core is gone; the
  function exists only so legacy callers don't blow up at import time.
* ``DslRemovedError`` is exposed for callers that explicitly want to
  treat the DSL path as a hard failure.

The shim never tries to pretend it parsed real DSL — that would mask
real errors and produce invalid ASTs downstream. Instead it returns an
empty AST snapshot with a single diagnostic so any pipeline that *does*
pass the result through still produces a well-typed, traceable failure.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from cicada_platform.core.schemas.ast import AstProgramSnapshot


class DslRemovedError(RuntimeError):
    """Raised when a caller insists the DSL path must succeed."""


_REMOVAL_NOTE: str = (
    "DSL→AST path removed. Use cicada_platform.compiler.pipeline.CompilePipeline."
    "compile_graph(graph_json) with IR Graph JSON. See GRAPH_ARCHITECTURE.md."
)


@dataclass(frozen=True)
class DslCompileResult:
    """Structured stand-in for the legacy parser output.

    Fields mirror the historic ``parse_dsl`` contract just enough for
    callers to introspect failure without crashing.
    """

    ok: bool = False
    ast: AstProgramSnapshot = field(default_factory=AstProgramSnapshot)
    diagnostics: list[str] = field(default_factory=list)
    program: Any | None = None

    @property
    def handlers(self) -> list:
        return []

    @property
    def scenarios(self) -> dict:
        return {}


def ensure_legacy_path() -> None:
    """No-op kept for legacy callers.

    Historically this function imported the C-side ``cic-st-core``
    runtime. That runtime was removed; it is now an intentional no-op
    so import-time legacy guards do not crash the platform process.
    """
    return None


def parse_dsl(source: str | None = None, *, strict: bool = False) -> DslCompileResult:
    """Stub that ALWAYS returns a structured failure (never crashes).

    Args:
        source: Ignored. Kept for legacy signature compatibility.
        strict: If True, raise ``DslRemovedError`` instead of returning
            a structured failure result.

    Returns:
        A ``DslCompileResult`` whose ``ok`` is False and whose
        ``diagnostics`` describes the migration. Downstream code can
        keep its existing flow (check ``ok``, surface diagnostics)
        without an ``ImportError``/``RuntimeError`` cascade.
    """
    if strict:
        raise DslRemovedError(_REMOVAL_NOTE)
    return DslCompileResult(
        ok=False,
        ast=AstProgramSnapshot(),
        diagnostics=[_REMOVAL_NOTE],
        program=None,
    )


__all__ = [
    "DslCompileResult",
    "DslRemovedError",
    "ensure_legacy_path",
    "parse_dsl",
]
