"""NativeOpRegistry — explicit native ops only (no legacy lazy binding)."""

from __future__ import annotations

from types import MappingProxyType
from typing import Any

from cicada_platform.compiler.ast_serialize import deserialize_stmt
from cicada_platform.core.schemas.ir_graph import IrGraphNode
from cicada_platform.runtime.config import is_graph_native_mode
from cicada_platform.runtime.guard import is_runtime_strict
from cicada_platform.runtime.ops.native import (
    GRAPH_ORCHESTRATED_OPS,
    NATIVE_OPS,
    NativeOpFn,
)
from cicada_platform.runtime.services import RuntimeServices


class NativeOpNotImplementedError(RuntimeError):
    """Op has no native implementation — strict mode raises at runtime."""


class RuntimeRegistryModificationError(RuntimeError):
    """Registry was sealed after boot; runtime mutation is forbidden."""

    MESSAGE = "Runtime modification of execution registry is forbidden"

    def __init__(self, *, context: str = "") -> None:
        msg = self.MESSAGE
        if context:
            msg = f"{msg} ({context})"
        super().__init__(msg)


class NativeOpRegistry:
    """Single source of execution: pre-registered platform-native async handlers."""

    def __init__(self, services: RuntimeServices) -> None:
        self._services = services
        self._sealed = False
        self._handlers: dict[str, NativeOpFn] | MappingProxyType = dict(NATIVE_OPS)
        self._seal()

    def _seal(self) -> None:
        """Freeze handler map after initialization (system boot for this registry)."""
        if self._sealed:
            return
        frozen = dict(self._handlers)
        self._handlers = MappingProxyType(frozen)
        self._sealed = True
        object.__setattr__(self, "register", self._register_forbidden)

    @staticmethod
    def _register_forbidden(op: str, fn: Any) -> None:
        raise RuntimeRegistryModificationError()

    def has(self, op: str) -> bool:
        return op in self._handlers or op in GRAPH_ORCHESTRATED_OPS or op == "Noop"

    def execute(self, op: str, payload: dict, ctx: Any) -> Any:
        if op == "Noop":
            return None
        if op in GRAPH_ORCHESTRATED_OPS:
            return None
        fn = self._handlers.get(op)
        if fn is None:
            if is_runtime_strict() or is_graph_native_mode():
                raise NativeOpNotImplementedError(
                    f"Op {op!r} has no native implementation. "
                    "Register it in runtime/ops/native/."
                )
            raise NativeOpNotImplementedError(f"Op {op!r} is not registered")
        stmt = deserialize_stmt(payload if "op" in payload else {"op": op, "payload": payload})
        fn(self._services, stmt, ctx)
        return None


def execute_node(engine: Any, node: IrGraphNode, ctx: Any) -> Any:
    return engine.ops.execute(node.op, node.payload, ctx)
