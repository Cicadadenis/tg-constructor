"""Queue abstraction for sandbox / scheduler."""

from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from typing import Any, Generic, TypeVar

T = TypeVar("T")


class AsyncQueue(ABC, Generic[T]):
    @abstractmethod
    async def push(self, item: T) -> str: ...

    @abstractmethod
    async def pop(self, timeout: float | None = None) -> T | None: ...


class InMemoryAsyncQueue(AsyncQueue[T]):
    def __init__(self, maxsize: int = 1000) -> None:
        self._q: asyncio.Queue[T] = asyncio.Queue(maxsize=maxsize)
        self._seq = 0

    async def push(self, item: T) -> str:
        self._seq += 1
        job_id = f"job-{self._seq}"
        await self._q.put(item)
        return job_id

    async def pop(self, timeout: float | None = None) -> T | None:
        if timeout is None:
            return await self._q.get()
        try:
            return await asyncio.wait_for(self._q.get(), timeout=timeout)
        except asyncio.TimeoutError:
            return None
