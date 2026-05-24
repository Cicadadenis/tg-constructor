"""NativeOpRegistry is immutable after instance initialization (boot)."""

from __future__ import annotations

import pytest

from cicada_platform.runtime.ops.registry import (
    NativeOpRegistry,
    RuntimeRegistryModificationError,
)
from cicada_platform.runtime.services import RuntimeServices


def _registry() -> NativeOpRegistry:
    program = type("P", (), {"globals": {}, "handlers": [], "scenarios": {}, "blocks": {}})()
    services = RuntimeServices(program, tg=object(), debug=False)
    return NativeOpRegistry(services)


def test_registry_sealed_after_init() -> None:
    reg = _registry()
    assert reg._sealed is True
    assert "Reply" in reg._handlers


def test_register_after_boot_raises() -> None:
    reg = _registry()
    with pytest.raises(RuntimeRegistryModificationError) as exc:
        reg.register("CustomOp", lambda *a, **k: None)
    assert exc.value.args[0] == RuntimeRegistryModificationError.MESSAGE


def test_handlers_mapping_is_read_only() -> None:
    reg = _registry()
    with pytest.raises(TypeError):
        reg._handlers["InjectedOp"] = lambda *a, **k: None
