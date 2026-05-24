"""Gate IrProgram / EventDispatcher paths — graph execution only in production."""

from __future__ import annotations

import os


class LegacyExecutionDisabledError(RuntimeError):
  """Raised when a flat IrProgram runtime path is used while legacy is disabled."""

  def __init__(self, context: str = "", hint: str = "") -> None:
    suffix = f": {context}" if context else ""
    guide = hint or (
      "Use IrProgramGraph with GraphExecutionEngine "
      "(POST /v1/constructor/graph/execute)."
    )
    super().__init__(
      f"Legacy execution is disabled (LEGACY_EXECUTION_ENABLED=false){suffix}. {guide}"
    )


def is_legacy_execution_enabled() -> bool:
  raw = os.environ.get("LEGACY_EXECUTION_ENABLED", "").strip().lower()
  if not raw:
    return False
  return raw in ("1", "true", "yes", "on")


def is_production_runtime() -> bool:
  env = (
    os.environ.get("APP_ENV", "") or os.environ.get("NODE_ENV", "")
  ).strip().lower()
  return env == "production"


def assert_legacy_execution_allowed(context: str = "") -> None:
  if is_legacy_execution_enabled():
    return
  raise LegacyExecutionDisabledError(
    context,
    "Set LEGACY_EXECUTION_ENABLED=true to use IrProgram / EventDispatcher.",
  )


def assert_graph_execution_only(context: str = "") -> None:
  """Inverse guard: graph runtime must not be blocked."""
  if is_legacy_execution_enabled():
    return
  # When legacy is off, graph paths are allowed; legacy paths use assert_legacy_execution_allowed.
  _ = context
