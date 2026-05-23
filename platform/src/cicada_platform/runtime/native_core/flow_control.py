"""Variable and op signals (NO orchestration)."""

from __future__ import annotations

import json as _json
import os as _os
import re
import time
from typing import TYPE_CHECKING

from cicada_platform.runtime.native_core.conditions import (
    LoopBreak,
    LoopContinue,
    CicadaRuntimeError,
    CicadaTypeError,
    eval_expr,
    render_item_template,
)

from cicada.parser import (
    BreakLoop,
    ContinueLoop,
    GlobalVar,
    Log,
    Remember,
    ReturnValue,
    SaveFile,
)

if TYPE_CHECKING:
    from cicada_platform.runtime.native_core.base import NativeRuntime


def apply_remember(rt: "NativeRuntime", stmt: Remember, ctx):
        value = rt.resolve_value(stmt.value, ctx)
        ctx.set(stmt.name, value)


def apply_global_var(rt: "NativeRuntime", stmt: GlobalVar, ctx):
        """Установить глобальную переменную (доступна всем пользователям)"""
        value = rt.resolve_value(stmt.value, ctx)
        ctx._globals[stmt.name] = value


def apply_break(rt: "NativeRuntime", stmt: BreakLoop, ctx):
        raise LoopBreak()


def apply_continue(rt: "NativeRuntime", stmt: ContinueLoop, ctx):
        raise LoopContinue()


def apply_save_file(rt: "NativeRuntime", stmt: SaveFile, ctx):
        ctx.set(stmt.variable, ctx.get("файл_id", ""))


def apply_log(rt: "NativeRuntime", stmt: Log, ctx):
        message = rt.render_parts(stmt.parts, ctx)
        rt.log("DEBUG" if rt.debug else "INFO", message, ctx)


def apply_return_value(rt: "NativeRuntime", stmt: ReturnValue, ctx):
        """вернуть значение — возврат из блока с значением."""
        value = rt.resolve_value(stmt.value, ctx)
        ctx._return_value   = value
        ctx._return_requested = True
