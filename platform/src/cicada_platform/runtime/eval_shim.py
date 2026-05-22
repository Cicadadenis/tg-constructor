"""Expression evaluation — platform native (no LegacyExecutor)."""

from __future__ import annotations

from typing import Any

from cicada_platform.runtime.services import RuntimeServices


class EvalShim:
    def __init__(self, services: RuntimeServices) -> None:
        self._services = services

    def eval_condition(self, condition: Any, ctx: Any) -> bool:
        return self._services.eval_condition(condition, ctx)

    def eval(self, node: Any, ctx: Any) -> Any:
        return self._services.eval(node, ctx)
