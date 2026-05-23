"""Runtime guards — block legacy execution paths during graph runs."""

from __future__ import annotations

import os
from typing import Any


class LegacyRuntimePathError(RuntimeError):
    """Raised when runtime would invoke cicada.executor.Executor."""


def is_runtime_strict() -> bool:
    return os.environ.get("CICADA_RUNTIME_STRICT", "").strip() in (
        "1",
        "true",
        "yes",
        "on",
    )


def assert_no_legacy_executor(obj: Any, *, context: str = "") -> None:
    """Fail if an Executor instance appears on the runtime path."""
    if not is_runtime_strict():
        return
    name = type(obj).__name__
    module = getattr(type(obj), "__module__", "")
    if name == "Executor" and module.startswith("cicada"):
        msg = "Legacy Executor is forbidden on the runtime execution path"
        if context:
            msg = f"{msg} ({context})"
        raise LegacyRuntimePathError(msg)


def forbid_legacy_import(context: str = "") -> None:
    if is_runtime_strict():
        raise LegacyRuntimePathError(
            f"Legacy import blocked in strict runtime mode ({context})"
        )
