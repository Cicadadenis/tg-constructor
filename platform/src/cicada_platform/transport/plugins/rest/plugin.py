"""REST ingress — maps HTTP body to CicadaEvent."""

from __future__ import annotations

from typing import Any

from cicada_platform.core.events.envelope import EffectEnvelope
from cicada_platform.core.events.models import CicadaEvent, EventKind


class RestTransportPlugin:
    name = "rest"

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
            chat_id=str(raw.get("chat_id", "rest")),
            text=str(raw.get("text", "")),
            payload=raw,
        )

    async def deliver(self, effect: EffectEnvelope) -> dict[str, Any]:
        return {"ok": True, "delivered_via": "rest_callback", "effect_id": effect.id}
