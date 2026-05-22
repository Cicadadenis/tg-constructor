"""Built-in action handlers."""

from __future__ import annotations

import asyncio
from typing import Any

import httpx

from cicada_platform.core.events.envelope import EffectEnvelope
from cicada_platform.runtime.action_registry import ActionRegistry
from cicada_platform.runtime.context import RuntimeContext


async def _send_message(ctx: RuntimeContext, params: dict[str, Any]) -> list[EffectEnvelope]:
    text = str(params.get("parts") or params.get("text") or "")
    return [
        EffectEnvelope(
            action="send_message",
            chat_id=ctx.chat_id,
            payload={"text": text},
        )
    ]


async def _edit_message(ctx: RuntimeContext, params: dict[str, Any]) -> list[EffectEnvelope]:
    return [
        EffectEnvelope(
            action="edit_message",
            chat_id=ctx.chat_id,
            payload=params,
        )
    ]


async def _send_buttons(ctx: RuntimeContext, params: dict[str, Any]) -> list[EffectEnvelope]:
    return [
        EffectEnvelope(
            action="send_buttons",
            chat_id=ctx.chat_id,
            payload=params,
        )
    ]


async def _ask(ctx: RuntimeContext, params: dict[str, Any]) -> list[EffectEnvelope]:
    var = str(params.get("variable", "answer"))
    ctx.waiting_for = var
    q = str(params.get("question", ""))
    return [
        EffectEnvelope(action="send_message", chat_id=ctx.chat_id, payload={"text": q}),
    ]


async def _set_state(ctx: RuntimeContext, params: dict[str, Any]) -> list[EffectEnvelope]:
    for k, v in params.items():
        if k in ("variable", "varname"):
            ctx.set(str(params.get("variable") or params.get("varname")), params.get("value"))
        else:
            ctx.set(k, v)
    return []


async def _delay(ctx: RuntimeContext, params: dict[str, Any]) -> list[EffectEnvelope]:
    seconds = float(params.get("seconds") or params.get("value") or 1)
    await asyncio.sleep(seconds)
    return []


async def _http_request(ctx: RuntimeContext, params: dict[str, Any]) -> list[EffectEnvelope]:
    method = str(params.get("method", "GET")).upper()
    url = str(params.get("url", ""))
    var = str(params.get("varname") or params.get("variable") or "http_result")
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.request(method, url, json=params.get("body"))
        ctx.set(var, {"status": resp.status_code, "text": resp.text[:8000]})
    return []


async def _storage(ctx: RuntimeContext, params: dict[str, Any]) -> list[EffectEnvelope]:
    return [
        EffectEnvelope(
            action="storage",
            chat_id=ctx.chat_id,
            payload=params,
        )
    ]


def register_builtin_actions(registry: ActionRegistry) -> None:
    registry.register("send_message", _send_message)
    registry.register("edit_message", _edit_message)
    registry.register("send_buttons", _send_buttons)
    registry.register("ask", _ask)
    registry.register("set_state", _set_state)
    registry.register("delay", _delay)
    registry.register("http_request", _http_request)
    registry.register("storage", _storage)
