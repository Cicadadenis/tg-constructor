"""Middleware pipeline (onion model)."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from cicada_platform.core.events.envelope import EffectEnvelope
from cicada_platform.core.events.models import CicadaEvent
from cicada_platform.runtime.context import RuntimeContext

MiddlewareFn = Callable[
    [CicadaEvent, RuntimeContext, Callable[[], Awaitable[list[EffectEnvelope]]]],
    Awaitable[list[EffectEnvelope]],
]


class MiddlewarePipeline:
    def __init__(self) -> None:
        self._chain: list[MiddlewareFn] = []

    def use(self, middleware: MiddlewareFn) -> None:
        self._chain.append(middleware)

    async def run(
        self,
        event: CicadaEvent,
        ctx: RuntimeContext,
        inner: Callable[[], Awaitable[list[EffectEnvelope]]],
    ) -> list[EffectEnvelope]:
        async def invoke(index: int) -> list[EffectEnvelope]:
            if index >= len(self._chain):
                return await inner()
            mw = self._chain[index]

            async def next_call() -> list[EffectEnvelope]:
                return await invoke(index + 1)

            return await mw(event, ctx, next_call)

        return await invoke(0)
