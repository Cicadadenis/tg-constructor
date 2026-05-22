"""Per-chat runtime context."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class RuntimeContext(BaseModel):
    chat_id: str
    user_id: str | None = None
    variables: dict[str, Any] = Field(default_factory=dict)
    current_state: str | None = None
    waiting_for: str | None = None
    scenario: str | None = None
    step: str | None = None

    def get(self, key: str, default: Any = None) -> Any:
        return self.variables.get(key, default)

    def set(self, key: str, value: Any) -> None:
        self.variables[key] = value
