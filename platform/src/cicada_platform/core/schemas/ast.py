"""AST snapshot (serializable) produced by compiler."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class AstProgramSnapshot(BaseModel):
    """Lightweight AST envelope; full AST remains in legacy parser until full port."""

    schema_version: int = 1
    config: dict[str, Any] = Field(default_factory=dict)
    handler_count: int = 0
    scenario_count: int = 0
    block_count: int = 0
    source_hash: str = ""
