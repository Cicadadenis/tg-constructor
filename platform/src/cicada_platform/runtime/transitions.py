"""Transition resolution."""

from __future__ import annotations

from cicada_platform.core.events.models import CicadaEvent
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from cicada_platform.core.schemas.ir import IrHandler, IrState
from cicada_platform.runtime.context import RuntimeContext


def match_handler(program_handlers: list, event: CicadaEvent):
    for h in program_handlers:
        if h.event == "start" and event.kind.value == "message" and event.text.startswith("/start"):
            return h
        if h.event == "command" and event.command and h.trigger and event.command == h.trigger:
            return h
        if h.event == "callback" and event.callback_data:
            if not h.trigger or h.trigger in event.callback_data:
                return h
        if h.event == "message" and event.kind.value == "message":
            if not h.trigger or h.trigger == event.text:
                return h
    return program_handlers[0] if program_handlers else None


def resolve_next_state(state, event: CicadaEvent, ctx: RuntimeContext) -> str | None:
    for tr in state.transitions:
        if tr.on == event.kind.value or tr.on == "*":
            if tr.condition and tr.condition not in str(ctx.variables):
                continue
            return tr.target
    return None
