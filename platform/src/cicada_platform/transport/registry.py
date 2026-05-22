"""Transport plugin registry."""

from __future__ import annotations

from cicada_platform.core.interfaces.transport import TransportPlugin


class TransportRegistry:
    def __init__(self) -> None:
        self._plugins: dict[str, TransportPlugin] = {}

    def register(self, plugin: TransportPlugin) -> None:
        self._plugins[plugin.name] = plugin

    def get(self, name: str) -> TransportPlugin | None:
        return self._plugins.get(name)

    async def start_all(self) -> None:
        for p in self._plugins.values():
            await p.start()

    async def stop_all(self) -> None:
        for p in self._plugins.values():
            await p.stop()
