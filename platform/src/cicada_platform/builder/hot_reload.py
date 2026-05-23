"""Hot reload watcher for .ccd / IR during dev."""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Callable


class HotReloadWatcher:
    def __init__(self, path: Path, on_change: Callable[[], None], interval: float = 1.0) -> None:
        self._path = path
        self._on_change = on_change
        self._interval = interval
        self._mtime: float | None = None
        self._task: asyncio.Task | None = None

    async def _loop(self) -> None:
        while True:
            try:
                mtime = self._path.stat().st_mtime
                if self._mtime is not None and mtime != self._mtime:
                    self._on_change()
                self._mtime = mtime
            except FileNotFoundError:
                pass
            await asyncio.sleep(self._interval)

    def start(self) -> None:
        self._task = asyncio.create_task(self._loop(), name="hot-reload")

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            await asyncio.gather(self._task, return_exceptions=True)
