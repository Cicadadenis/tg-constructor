"""Minimal dependency injection container."""

from __future__ import annotations

from typing import Any, Callable, TypeVar

T = TypeVar("T")


class Container:
    def __init__(self) -> None:
        self._singletons: dict[str, Any] = {}
        self._factories: dict[str, Callable[[], Any]] = {}

    def register_singleton(self, key: str, instance: Any) -> None:
        self._singletons[key] = instance

    def register_factory(self, key: str, factory: Callable[[], Any]) -> None:
        self._factories[key] = factory

    def resolve(self, key: str) -> Any:
        if key in self._singletons:
            return self._singletons[key]
        if key in self._factories:
            inst = self._factories[key]()
            self._singletons[key] = inst
            return inst
        raise KeyError(f"DI: unknown key {key!r}")

    def try_resolve(self, key: str) -> Any | None:
        try:
            return self.resolve(key)
        except KeyError:
            return None
