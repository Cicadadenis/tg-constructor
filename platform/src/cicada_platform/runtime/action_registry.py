"""Action registry — all side effects go through registered handlers."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from cicada_platform.core.events.envelope import EffectEnvelope
from cicada_platform.runtime.context import RuntimeContext

ActionHandler = Callable[[RuntimeContext, dict[str, Any]], Awaitable[list[EffectEnvelope]]]


class ActionRegistry:
    def __init__(self) -> None:
        self._handlers: dict[str, ActionHandler] = {}

    def register(self, action_type: str, handler: ActionHandler) -> None:
        self._handlers[action_type] = handler

    def has(self, action_type: str) -> bool:
        return action_type in self._handlers

    async def execute(
        self, action_type: str, ctx: RuntimeContext, params: dict[str, Any]
    ) -> list[EffectEnvelope]:
        handler = self._handlers.get(action_type)
        if not handler:
            return [
                EffectEnvelope(
                    action="log",
                    chat_id=ctx.chat_id,
                    payload={"level": "warn", "message": f"unknown action {action_type!r}"},
                )
            ]
        return await handler(ctx, params)
