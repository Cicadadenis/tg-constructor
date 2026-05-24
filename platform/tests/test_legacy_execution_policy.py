"""LEGACY_EXECUTION_ENABLED gates flat IrProgram paths."""

from __future__ import annotations

import os

import pytest

from cicada_platform.core.schemas.ir import IrProgram
from cicada_platform.runtime.legacy_execution_policy import (
    LegacyExecutionDisabledError,
    assert_legacy_execution_allowed,
    is_legacy_execution_enabled,
)


def test_legacy_disabled_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("LEGACY_EXECUTION_ENABLED", raising=False)
    assert is_legacy_execution_enabled() is False
    with pytest.raises(LegacyExecutionDisabledError):
        assert_legacy_execution_allowed("test")


def test_event_dispatcher_blocked_without_legacy(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("LEGACY_EXECUTION_ENABLED", raising=False)
    from cicada_platform.runtime.action_registry import ActionRegistry
    from cicada_platform.runtime.dispatcher import EventDispatcher

    program = IrProgram(handlers=[])
    with pytest.raises(LegacyExecutionDisabledError):
        EventDispatcher(program, ActionRegistry())


def test_event_dispatcher_allowed_with_legacy(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LEGACY_EXECUTION_ENABLED", "true")
    from cicada_platform.runtime.action_registry import ActionRegistry
    from cicada_platform.runtime.dispatcher import EventDispatcher

    program = IrProgram(handlers=[])
    EventDispatcher(program, ActionRegistry())
