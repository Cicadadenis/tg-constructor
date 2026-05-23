"""Lazy observability install — hooks + trace store (intelligence bootstrap)."""

from __future__ import annotations

_installed = False


def register_layer_bootstrap() -> None:
    """Wire intelligence install into trace layer without trace→debug import."""
    from cicada_platform.runtime.trace import register_observability_bootstrap

    register_observability_bootstrap(ensure_observability)


def ensure_observability() -> None:
    global _installed

    from cicada_platform.runtime.config import (
        is_exec_profile_mode,
        is_exec_replay_mode,
        is_exec_trace_mode,
    )

    if not (is_exec_trace_mode() or is_exec_replay_mode() or is_exec_profile_mode()):
        return
    if _installed:
        return
    _installed = True

    from cicada_platform.debug.hooks import get_hook_registry
    from cicada_platform.debug.trace_store import get_trace_store
    from cicada_platform.runtime.trace import register_trace_observer

    store = get_trace_store()

    def _observer(event, trace) -> None:
        from cicada_platform.debug.hooks import dispatch_trace_event

        dispatch_trace_event(event, trace)
        if event.kind.value == "execution_end":
            store.put(trace)

    register_trace_observer(_observer)

    if is_exec_profile_mode():
        _install_profile_hooks(get_hook_registry())


def _install_profile_hooks(reg) -> None:
    timings: dict[str, float] = {}

    def _on_enter(event, trace) -> None:
        import time

        if event.node_id:
            timings[event.node_id] = time.perf_counter()

    def _on_exit(event, trace) -> None:
        import time

        if event.node_id and event.node_id in timings:
            ms = (time.perf_counter() - timings.pop(event.node_id)) * 1000.0
            event.detail["profile_duration_ms"] = round(ms, 3)

    reg.on_node_enter.append(_on_enter)
    reg.on_node_exit.append(_on_exit)
