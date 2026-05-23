"""Intermediate representation (IR) — runtime input, not DSL text."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class IrAction(BaseModel):
    type: str
    params: dict[str, Any] = Field(default_factory=dict)


class IrTransition(BaseModel):
    on: str
    target: str
    condition: str | None = None


class IrState(BaseModel):
    id: str
    actions: list[IrAction] = Field(default_factory=list)
    transitions: list[IrTransition] = Field(default_factory=list)


class IrHandler(BaseModel):
    event: Literal["start", "message", "callback", "command", "media"]
    trigger: str | None = None
    entry_state: str
    states: list[IrState] = Field(default_factory=list)


class IrProgram(BaseModel):
    schema_version: int = 1
    name: str = "bot"
    config: dict[str, Any] = Field(default_factory=dict)
    handlers: list[IrHandler] = Field(default_factory=list)
    globals: dict[str, Any] = Field(default_factory=dict)
