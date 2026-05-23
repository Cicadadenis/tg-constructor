"""In-memory trace archive for export/replay by trace_id."""

from __future__ import annotations

from cicada_platform.runtime.trace import ExecutionTrace


class TraceStore:
    def __init__(self) -> None:
        self._by_id: dict[str, ExecutionTrace] = {}

    def put(self, trace: ExecutionTrace) -> None:
        self._by_id[trace.trace_id] = trace

    def get(self, trace_id: str) -> ExecutionTrace | None:
        return self._by_id.get(trace_id)

    def list_ids(self) -> list[str]:
        return list(self._by_id.keys())


_STORE = TraceStore()


def get_trace_store() -> TraceStore:
    return _STORE
