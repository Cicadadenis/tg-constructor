"""Transport plugin contract — no Telegram imports here."""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from cicada_platform.core.events.envelope import EffectEnvelope
from cicada_platform.core.events.models import CicadaEvent


@runtime_checkable
class TransportPlugin(Protocol):
    name: str

    async def start(self) -> None: ...
    async def stop(self) -> None: ...

    async def normalize_inbound(self, raw: Any) -> CicadaEvent | None: ...
    async def deliver(self, effect: EffectEnvelope) -> dict[str, Any]: ...
