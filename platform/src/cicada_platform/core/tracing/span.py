"""Lightweight tracing spans (OpenTelemetry-ready)."""

from __future__ import annotations

import time
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from typing import AsyncIterator
from uuid import uuid4


@dataclass
class Span:
    name: str
    trace_id: str = field(default_factory=lambda: uuid4().hex)
    span_id: str = field(default_factory=lambda: uuid4().hex[:16])
    attributes: dict[str, str] = field(default_factory=dict)
    started_at: float = field(default_factory=time.perf_counter)
    ended_at: float | None = None

    def finish(self) -> None:
        self.ended_at = time.perf_counter()

    @property
    def duration_ms(self) -> float:
        end = self.ended_at or time.perf_counter()
        return (end - self.started_at) * 1000


@asynccontextmanager
async def trace_span(name: str, **attrs: str) -> AsyncIterator[Span]:
    span = Span(name=name, attributes={k: str(v) for k, v in attrs.items()})
    try:
        yield span
    finally:
        span.finish()
