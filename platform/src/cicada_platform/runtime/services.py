"""Runtime services — NativeRuntime + session (no LegacyExecutor)."""

from __future__ import annotations

from typing import Any

from cicada_platform.runtime.native_core import NativeRuntime
from cicada_platform.runtime.native_core import messaging


class RuntimeServices:
    """Execution environment for NativeOps (orchestration stays in GraphExecutionEngine)."""

    def __init__(
        self,
        program: object,
        tg: Any,
        *,
        debug: bool = False,
        store: Any = None,
        http: Any = None,
        file_base_path: str | None = None,
    ) -> None:
        self.program = program
        self.tg = tg
        self.native = NativeRuntime(
            program,
            tg,
            debug=debug,
            store=store,
            http=http,
            file_base_path=file_base_path,
        )

    @property
    def effects(self) -> list:
        return self.native.effects

    def user(self, *args: Any, **kwargs: Any):
        return self.native.session_store.user(*args, **kwargs)

    def eval_condition(self, condition: Any, ctx: Any) -> bool:
        return self.native.evaluate_condition(condition, ctx)

    def eval(self, node: Any, ctx: Any) -> Any:
        return self.native.evaluate(node, ctx)

    def flush(self, ctx: Any) -> None:
        messaging.flush_pending(self.native, ctx)
