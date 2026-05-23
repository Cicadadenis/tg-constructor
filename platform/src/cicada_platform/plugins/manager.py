"""Plugin manager — loads SDK plugins into runtime."""

from __future__ import annotations

from cicada_platform.core.events.bus import EventBus
from cicada_platform.runtime.action_registry import ActionRegistry
from cicada_platform.runtime.middleware import MiddlewarePipeline
from cicada_platform.sdk.base import CicadaPlugin
from cicada_platform.transport.registry import TransportRegistry


class PluginManager:
    def __init__(self) -> None:
        self._plugins: list[CicadaPlugin] = []

    def register(self, plugin: CicadaPlugin) -> None:
        self._plugins.append(plugin)

    def apply(
        self,
        *,
        actions: ActionRegistry,
        transports: TransportRegistry,
        bus: EventBus,
        middleware: MiddlewarePipeline,
    ) -> None:
        for plugin in self._plugins:
            plugin.register_actions(actions)
            plugin.register_transports(transports)
            plugin.register_events(bus)
            plugin.register_middleware(middleware)
            plugin.register_blocks()
