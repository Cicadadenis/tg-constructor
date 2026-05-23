"""Generic webhook transport."""

from __future__ import annotations

from typing import Any

from cicada_platform.core.events.envelope import EffectEnvelope
from cicada_platform.core.events.models import CicadaEvent, EventKind


class WebhookTransportPlugin:
    name = "webhook"

    def __init__(self, callback_url: str | None = None) -> None:
        self._callback_url = callback_url

    async def start(self) -> None:
        return None

    async def stop(self) -> None:
        return None

    async def normalize_inbound(self, raw: Any) -> CicadaEvent | None:
        if not isinstance(raw, dict):
            return None
        return CicadaEvent(
            kind=EventKind.WEBHOOK,
            transport=self.name,
            chat_id=str(raw.get("chat_id", "webhook")),
            payload=raw,
        )

    async def deliver(self, effect: EffectEnvelope) -> dict[str, Any]:
        if not self._callback_url:
            return {"ok": True, "queued": True, "effect": effect.model_dump()}
        import httpx

        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(self._callback_url, json=effect.model_dump())
            return {"ok": True, "status": r.status_code}
