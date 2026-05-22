"""Fluent plugin registration (no decorator handlers)."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from cicada_platform.core.events.bus import EventBus
from cicada_platform.core.events.envelope import EffectEnvelope
from cicada_platform.core.events.models import CicadaEvent
from cicada_platform.runtime.action_registry import ActionRegistry
from cicada_platform.runtime.context import RuntimeContext
from cicada_platform.runtime.middleware import MiddlewarePipeline
from cicada_platform.sdk.base import CicadaPlugin
from cicada_platform.transport.registry import TransportRegistry

ActionFn = Callable[[RuntimeContext, dict[str, Any]], Awaitable[list[EffectEnvelope]]]


class PluginBuilder(CicadaPlugin):
    def __init__(self, name: str) -> None:
        self.name = name
        self._actions: dict[str, ActionFn] = {}
        self._transports: list[Any] = []
        self._event_handlers: list[Callable[[CicadaEvent], Awaitable[None]]] = []
        self._middleware: list[Any] = []
        self._blocks: list[dict[str, Any]] = []

    def action(self, action_type: str, handler: ActionFn) -> PluginBuilder:
        self._actions[action_type] = handler
        return self

    def transport(self, plugin: Any) -> PluginBuilder:
        self._transports.append(plugin)
        return self

    def on_event(self, handler: Callable[[CicadaEvent], Awaitable[None]]) -> PluginBuilder:
        self._event_handlers.append(handler)
        return self

    def block(self, definition: dict[str, Any]) -> PluginBuilder:
        self._blocks.append(definition)
        return self

    def register_actions(self, registry: ActionRegistry) -> None:
        for k, fn in self._actions.items():
            registry.register(k, fn)

    def register_transports(self, registry: TransportRegistry) -> None:
        for t in self._transports:
            registry.register(t)

    def register_events(self, bus: EventBus) -> None:
        for h in self._event_handlers:
            bus.subscribe(None, h)

    def register_middleware(self, pipeline: MiddlewarePipeline) -> None:
        for mw in self._middleware:
            pipeline.use(mw)

    def register_blocks(self) -> None:
        return None
