"""Simple async scheduler."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any


@dataclass
class ScheduledTask:
    name: str
    interval_seconds: float
    coro_factory: Callable[[], Awaitable[None]]


class TaskScheduler:
    def __init__(self) -> None:
        self._tasks: list[ScheduledTask] = []
        self._handles: list[asyncio.Task[Any]] = []

    def register(self, task: ScheduledTask) -> None:
        self._tasks.append(task)

    async def _loop(self, task: ScheduledTask) -> None:
        while True:
            await task.coro_factory()
            await asyncio.sleep(task.interval_seconds)

    def start(self) -> None:
        for t in self._tasks:
            self._handles.append(asyncio.create_task(self._loop(t), name=t.name))

    async def stop(self) -> None:
        for h in self._handles:
            h.cancel()
        await asyncio.gather(*self._handles, return_exceptions=True)
        self._handles.clear()
