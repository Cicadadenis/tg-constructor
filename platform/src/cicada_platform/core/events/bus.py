"""Async event bus (pub/sub)."""

from __future__ import annotations

import asyncio
from collections import defaultdict
from collections.abc import Awaitable, Callable
from typing import Any

from cicada_platform.core.events.models import CicadaEvent

EventHandler = Callable[[CicadaEvent], Awaitable[None]]


class EventBus:
    def __init__(self) -> None:
        self._handlers: dict[str, list[EventHandler]] = defaultdict(list)
        self._wildcard: list[EventHandler] = []

    def subscribe(self, event_kind: str | None, handler: EventHandler) -> None:
        if event_kind is None:
            self._wildcard.append(handler)
            return
        self._handlers[event_kind].append(handler)

    async def publish(self, event: CicadaEvent) -> None:
        handlers = list(self._wildcard) + list(self._handlers.get(event.kind, []))
        if not handlers:
            return
        await asyncio.gather(*(h(event) for h in handlers), return_exceptions=False)

    async def publish_safe(self, event: CicadaEvent) -> list[Any]:
        handlers = list(self._wildcard) + list(self._handlers.get(event.kind, []))
        return await asyncio.gather(*(h(event) for h in handlers), return_exceptions=True)
