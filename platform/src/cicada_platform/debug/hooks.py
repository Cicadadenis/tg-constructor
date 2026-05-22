"""Non-invasive debug hooks — observability only."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Protocol

from cicada_platform.runtime.trace import ExecutionTrace, TraceEvent, TraceEventKind


class DebugHooks(Protocol):
    def on_node_enter(self, event: TraceEvent, trace: ExecutionTrace) -> None: ...
    def on_node_exit(self, event: TraceEvent, trace: ExecutionTrace) -> None: ...
    def on_suspend(self, event: TraceEvent, trace: ExecutionTrace) -> None: ...
    def on_resume(self, event: TraceEvent, trace: ExecutionTrace) -> None: ...


@dataclass
class HookRegistry:
    on_node_enter: list[Callable[[TraceEvent, ExecutionTrace], None]] = field(default_factory=list)
    on_node_exit: list[Callable[[TraceEvent, ExecutionTrace], None]] = field(default_factory=list)
    on_suspend: list[Callable[[TraceEvent, ExecutionTrace], None]] = field(default_factory=list)
    on_resume: list[Callable[[TraceEvent, ExecutionTrace], None]] = field(default_factory=list)

    def dispatch(self, event: TraceEvent, trace: ExecutionTrace) -> None:
        if event.kind == TraceEventKind.NODE_ENTER:
            for fn in self.on_node_enter:
                fn(event, trace)
        elif event.kind == TraceEventKind.NODE_EXIT:
            for fn in self.on_node_exit:
                fn(event, trace)
        elif event.kind == TraceEventKind.SUSPEND:
            for fn in self.on_suspend:
                fn(event, trace)
        elif event.kind == TraceEventKind.RESUME:
            for fn in self.on_resume:
                fn(event, trace)


_GLOBAL_HOOKS = HookRegistry()


def get_hook_registry() -> HookRegistry:
    return _GLOBAL_HOOKS


def register_hooks(hooks: DebugHooks) -> None:
    reg = get_hook_registry()
    if hasattr(hooks, "on_node_enter"):
        reg.on_node_enter.append(hooks.on_node_enter)
    if hasattr(hooks, "on_node_exit"):
        reg.on_node_exit.append(hooks.on_node_exit)
    if hasattr(hooks, "on_suspend"):
        reg.on_suspend.append(hooks.on_suspend)
    if hasattr(hooks, "on_resume"):
        reg.on_resume.append(hooks.on_resume)


def dispatch_trace_event(event: TraceEvent, trace: ExecutionTrace) -> None:
    get_hook_registry().dispatch(event, trace)
