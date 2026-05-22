"""Unified event model (platform-agnostic)."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import StrEnum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


class EventKind(StrEnum):
    MESSAGE = "message"
    CALLBACK = "callback"
    COMMAND = "command"
    MEDIA = "media"
    WEBHOOK = "webhook"
    TIMER = "timer"
    SYSTEM = "system"


class CicadaEvent(BaseModel):
    """Normalized inbound event for dispatcher / state machine."""

    id: str = Field(default_factory=lambda: uuid4().hex)
    kind: EventKind
    transport: str = "unknown"
    chat_id: str
    user_id: str | None = None
    text: str = ""
    callback_data: str = ""
    command: str = ""
    media_type: str = ""
    file_id: str = ""
    payload: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = {"frozen": True}
