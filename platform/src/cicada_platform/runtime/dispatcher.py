"""Routes events to state machine + actions."""

from __future__ import annotations

from cicada_platform.core.events.envelope import EffectEnvelope
from cicada_platform.core.events.models import CicadaEvent
from cicada_platform.core.schemas.ir import IrProgram
from cicada_platform.runtime.action_registry import ActionRegistry
from cicada_platform.runtime.context import RuntimeContext
from cicada_platform.runtime.middleware import MiddlewarePipeline
from cicada_platform.runtime.state_machine import StateMachineEngine


class EventDispatcher:
    def __init__(
        self,
        program: IrProgram,
        registry: ActionRegistry,
        middleware: MiddlewarePipeline | None = None,
    ) -> None:
        self._program = program
        self._registry = registry
        self._sm = StateMachineEngine(program)
        self._middleware = middleware or MiddlewarePipeline()
        self._contexts: dict[str, RuntimeContext] = {}

    def context_for(self, event: CicadaEvent) -> RuntimeContext:
        if event.chat_id not in self._contexts:
            self._contexts[event.chat_id] = RuntimeContext(
                chat_id=event.chat_id, user_id=event.user_id
            )
        ctx = self._contexts[event.chat_id]
        if event.text:
            ctx.set("текст", event.text)
        if event.callback_data:
            ctx.set("кнопка", event.callback_data)
        return ctx

    async def dispatch(self, event: CicadaEvent) -> list[EffectEnvelope]:
        ctx = self.context_for(event)

        async def inner() -> list[EffectEnvelope]:
            handler = self._sm.select_handler(event)
            if not handler:
                return []
            state = self._sm.entry_state(handler)
            if not state:
                return []
            effects: list[EffectEnvelope] = []
            for action in state.actions:
                batch = await self._registry.execute(action.type, ctx, action.params)
                effects.extend(batch)
            self._sm.advance(state, event, ctx)
            return effects

        return await self._middleware.run(event, ctx, inner)
