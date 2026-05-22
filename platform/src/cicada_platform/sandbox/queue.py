"""Sandbox job queue."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from cicada_platform.core.queue.abstraction import InMemoryAsyncQueue


@dataclass(frozen=True)
class SandboxJob:
    job_id: str
    user_id: str
    ir_payload: dict[str, Any]
    event_payload: dict[str, Any]


class SandboxJobQueue:
    def __init__(self) -> None:
        self._queue: InMemoryAsyncQueue[SandboxJob] = InMemoryAsyncQueue()

    async def enqueue(self, job: SandboxJob) -> str:
        await self._queue.push(job)
        return job.job_id

    async def dequeue(self, timeout: float = 5.0) -> SandboxJob | None:
        item = await self._queue.pop(timeout=timeout)
        return item
