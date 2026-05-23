"""
TRACE LAYER — LEVEL_0 canonical event log only.

No intelligence imports. No execution orchestration. No interpretation.
Observers are optional callbacks registered externally (see register_observability_bootstrap).
"""

from __future__ import annotations

import uuid
from collections.abc import Callable
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field

LAYER = "trace"


class TraceEventKind(StrEnum):
    EXECUTION_START = "execution_start"
    NODE_ENTER = "node_enter"
    NODE_EXIT = "node_exit"
    TRANSITION_TAKEN = "transition_taken"
    CONDITION_EVALUATED = "condition_evaluated"
    ACTION_EXECUTED = "action_executed"
    ERROR_EVENT = "error_event"
    HANDLER_MATCHED = "handler_matched"
    SUSPEND = "suspend"
    RESUME = "resume"
    EXECUTION_END = "execution_end"


class TraceEvent(BaseModel):
    kind: TraceEventKind
    seq: int = 0
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    node_id: str | None = None
    op: str | None = None
    detail: dict[str, Any] = Field(default_factory=dict)


_TRACE_OBSERVERS: list = []
_OBSERVABILITY_BOOTSTRAP: Callable[[], None] | None = None


def register_trace_observer(fn) -> None:
    """Register passive observer (intelligence layer registers at bootstrap)."""
    _TRACE_OBSERVERS.append(fn)


def register_observability_bootstrap(fn: Callable[[], None]) -> None:
    """Intelligence layer registers install hook without trace importing debug."""
    global _OBSERVABILITY_BOOTSTRAP
    _OBSERVABILITY_BOOTSTRAP = fn


class ExecutionTrace:
    """Ordered, reconstructable trace for one inbound event (single execution context)."""

    def __init__(self, trace_id: str | None = None) -> None:
        self.trace_id = trace_id or str(uuid.uuid4())
        self.events: list[TraceEvent] = []
        self._seq = 0

    def emit(self, kind: TraceEventKind, **detail: Any) -> None:
        if _OBSERVABILITY_BOOTSTRAP is not None:
            _OBSERVABILITY_BOOTSTRAP()
        self._seq += 1
        event = TraceEvent(
            kind=kind,
            seq=self._seq,
            node_id=detail.pop("node_id", None),
            op=detail.pop("op", None),
            detail=detail,
        )
        self.events.append(event)
        for observer in _TRACE_OBSERVERS:
            observer(event, self)

    def to_list(self) -> list[dict[str, Any]]:
        return [e.model_dump() for e in self.events]

    def export(self) -> dict[str, Any]:
        """LEVEL_0 document only (no derived fields)."""
        return {
            "trace_id": self.trace_id,
            "event_count": len(self.events),
            "events": self.to_list(),
            "layer": LAYER,
        }
