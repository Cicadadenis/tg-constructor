"""Discord transport stub (webhook / gateway ready)."""

from __future__ import annotations

from typing import Any

from cicada_platform.core.events.envelope import EffectEnvelope
from cicada_platform.core.events.models import CicadaEvent, EventKind


class DiscordTransportPlugin:
    name = "discord"

    async def start(self) -> None:
        return None

    async def stop(self) -> None:
        return None

    async def normalize_inbound(self, raw: Any) -> CicadaEvent | None:
        if not isinstance(raw, dict):
            return None
        return CicadaEvent(
            kind=EventKind.MESSAGE,
            transport=self.name,
            chat_id=str(raw.get("channel_id", "")),
            user_id=str(raw.get("author", {}).get("id", "")),
            text=str(raw.get("content", "")),
            payload=raw,
        )

    async def deliver(self, effect: EffectEnvelope) -> dict[str, Any]:
        return {"ok": True, "transport": self.name, "action": effect.action, "stub": True}
