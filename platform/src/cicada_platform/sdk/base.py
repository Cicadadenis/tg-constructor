"""Plugin SDK base class."""

from __future__ import annotations

from abc import ABC, abstractmethod

from cicada_platform.core.events.bus import EventBus
from cicada_platform.runtime.action_registry import ActionRegistry
from cicada_platform.runtime.middleware import MiddlewarePipeline
from cicada_platform.transport.registry import TransportRegistry


class CicadaPlugin(ABC):
    name: str = "plugin"

    @abstractmethod
    def register_actions(self, registry: ActionRegistry) -> None: ...

    def register_transports(self, registry: TransportRegistry) -> None:
        return None

    def register_events(self, bus: EventBus) -> None:
        return None

    def register_middleware(self, pipeline: MiddlewarePipeline) -> None:
        return None

    def register_blocks(self) -> None:
        """Register visual builder block definitions (marketplace)."""
        return None
