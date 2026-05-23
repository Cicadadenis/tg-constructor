"""Web runtime transport (SSE / WS inbound)."""

from __future__ import annotations

from typing import Any

from cicada_platform.core.events.envelope import EffectEnvelope
from cicada_platform.core.events.models import CicadaEvent, EventKind


class WebRuntimeTransportPlugin:
    name = "web"

    async def start(self) -> None:
        return None

    async def stop(self) -> None:
        return None

    async def normalize_inbound(self, raw: Any) -> CicadaEvent | None:
        if not isinstance(raw, dict):
            return None
        return CicadaEvent(
            kind=EventKind(raw.get("kind", EventKind.MESSAGE)),
            transport=self.name,
            chat_id=str(raw.get("session_id", raw.get("chat_id", "web"))),
            text=str(raw.get("text", "")),
            payload=raw,
        )

    async def deliver(self, effect: EffectEnvelope) -> dict[str, Any]:
        return {"ok": True, "channel": "web", "effect": effect.model_dump()}
