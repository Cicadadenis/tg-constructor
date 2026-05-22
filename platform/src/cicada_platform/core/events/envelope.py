"""Outbound effect envelope (transport-agnostic)."""

from __future__ import annotations

from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


class EffectEnvelope(BaseModel):
    id: str = Field(default_factory=lambda: uuid4().hex)
    action: str
    target_transport: str | None = None
    chat_id: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
