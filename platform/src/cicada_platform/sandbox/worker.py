"""Isolated sandbox worker — runtime → queue → worker → result."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any

from cicada_platform.core.events.models import CicadaEvent
from cicada_platform.core.schemas.ir_graph import IrProgramGraph
from cicada_platform.runtime.graph_engine import GraphExecutionEngine
from cicada_platform.sandbox.queue import SandboxJob, SandboxJobQueue


@dataclass
class SandboxResult:
    job_id: str
    ok: bool
    effects: list[dict[str, Any]]
    error: str | None = None


class SandboxWorkerPool:
    def __init__(self, queue: SandboxJobQueue, *, workers: int = 2) -> None:
        self._queue = queue
        self._workers = workers
        self._tasks: list[asyncio.Task[Any]] = []
        self._results: dict[str, SandboxResult] = {}

    async def _run_worker(self) -> None:
        while True:
            job = await self._queue.dequeue(timeout=1.0)
            if not job:
                await asyncio.sleep(0.05)
                continue
            try:
                graph = IrProgramGraph.model_validate(job.ir_payload)
                from cicada.adapters.mock_telegram import MockTelegramAdapter

                engine = GraphExecutionEngine(graph, MockTelegramAdapter())
                effects = engine.handle_update(job.event_payload)
                self._results[job.job_id] = SandboxResult(
                    job_id=job.job_id,
                    ok=True,
                    effects=[e.model_dump() for e in effects],
                )
            except Exception as exc:
                self._results[job.job_id] = SandboxResult(
                    job_id=job.job_id, ok=False, effects=[], error=str(exc)
                )

    def start(self) -> None:
        for i in range(self._workers):
            self._tasks.append(asyncio.create_task(self._run_worker(), name=f"sandbox-{i}"))

    async def stop(self) -> None:
        for t in self._tasks:
            t.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)

    def get_result(self, job_id: str) -> SandboxResult | None:
        return self._results.get(job_id)
