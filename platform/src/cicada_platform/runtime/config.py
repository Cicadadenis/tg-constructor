"""Runtime configuration."""

from __future__ import annotations

import os


def is_graph_native_mode() -> bool:
    return os.environ.get("CICADA_GRAPH_NATIVE_MODE", "").strip() in (
        "1",
        "true",
        "yes",
        "on",
    )


def is_runtime_strict() -> bool:
    """CICADA_RUNTIME_STRICT=1 — missing native op → runtime error (no silent fallback)."""
    return os.environ.get("CICADA_RUNTIME_STRICT", "").strip() in (
        "1",
        "true",
        "yes",
        "on",
    )


def is_exec_trace_mode() -> bool:
    """CICADA_EXEC_TRACE_MODE=1 — export full execution trace per handle_update."""
    return os.environ.get("CICADA_EXEC_TRACE_MODE", "").strip() in (
        "1",
        "true",
        "yes",
        "on",
    )


def is_exec_replay_mode() -> bool:
    """CICADA_EXEC_REPLAY_MODE=1 — enable offline trace replay (no side effects)."""
    return os.environ.get("CICADA_EXEC_REPLAY_MODE", "").strip() in (
        "1",
        "true",
        "yes",
        "on",
    )


def is_exec_profile_mode() -> bool:
    """CICADA_EXEC_PROFILE_MODE=1 — per-node timing in trace detail."""
    return os.environ.get("CICADA_EXEC_PROFILE_MODE", "").strip() in (
        "1",
        "true",
        "yes",
        "on",
    )
