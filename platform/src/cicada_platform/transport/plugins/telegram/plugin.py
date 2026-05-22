"""Telegram transport plugin (HTTP Bot API — no aiogram decorators)."""

from __future__ import annotations

from typing import Any

import httpx

from cicada_platform.core.events.envelope import EffectEnvelope
from cicada_platform.core.events.models import CicadaEvent, EventKind
from cicada_platform.core.interfaces.transport import TransportPlugin


class TelegramTransportPlugin:
    name = "telegram"

    def __init__(self, token: str) -> None:
        self._token = token
        self._client = httpx.AsyncClient(
            base_url=f"https://api.telegram.org/bot{token}/",
            timeout=35.0,
        )
        self._offset: int | None = None

    async def start(self) -> None:
        return None

    async def stop(self) -> None:
        await self._client.aclose()

    async def normalize_inbound(self, raw: Any) -> CicadaEvent | None:
        if not isinstance(raw, dict):
            return None
        if cq := raw.get("callback_query"):
            msg = cq.get("message", {})
            chat = msg.get("chat", {})
            return CicadaEvent(
                kind=EventKind.CALLBACK,
                transport=self.name,
                chat_id=str(chat.get("id", "")),
                user_id=str(cq.get("from", {}).get("id", "")),
                callback_data=str(cq.get("data", "")),
                payload=raw,
            )
        if msg := raw.get("message"):
            chat = msg.get("chat", {})
            text = msg.get("text", "")
            kind = EventKind.COMMAND if text.startswith("/") else EventKind.MESSAGE
            return CicadaEvent(
                kind=kind,
                transport=self.name,
                chat_id=str(chat.get("id", "")),
                user_id=str(msg.get("from", {}).get("id", "")),
                text=text,
                command=text.split()[0] if kind == EventKind.COMMAND else "",
                payload=raw,
            )
        return None

    async def deliver(self, effect: EffectEnvelope) -> dict[str, Any]:
        chat_id = effect.chat_id
        if effect.action == "send_message":
            text = effect.payload.get("text", " ")
            r = await self._client.post(
                "sendMessage", json={"chat_id": int(chat_id), "text": text}
            )
            return r.json()
        if effect.action == "send_buttons":
            labels = effect.payload.get("labels") or effect.payload.get("rows") or []
            keyboard = {
                "inline_keyboard": [[{"text": str(l), "callback_data": str(l)}] for l in labels]
            }
            r = await self._client.post(
                "sendMessage",
                json={
                    "chat_id": int(chat_id),
                    "text": effect.payload.get("text", " "),
                    "reply_markup": keyboard,
                },
            )
            return r.json()
        return {"ok": True, "skipped": effect.action}

    async def poll_once(self) -> list[CicadaEvent]:
        payload: dict[str, Any] = {"timeout": 0, "limit": 50}
        if self._offset is not None:
            payload["offset"] = self._offset
        r = await self._client.post("getUpdates", json=payload)
        data = r.json()
        events: list[CicadaEvent] = []
        for u in data.get("result", []):
            self._offset = int(u.get("update_id", 0)) + 1
            ev = await self.normalize_inbound(u)
            if ev:
                events.append(ev)
        return events
