"""NativeRuntime — effect sink and evaluation facade (no orchestration)."""

from __future__ import annotations

import os as _os
import re
from typing import Any

from cicada.core import CoreEffect, RequestsHttpClient
from cicada.database import get_db
from cicada.parser import Program

from cicada_platform.runtime.native_core import conditions, storage
from cicada_platform.runtime.session import SessionRuntime


class NativeRuntime:
    """Effect runtime: transport, persistence, session, evaluation (no control plane)."""

    def __init__(
        self,
        program: Program,
        tg: Any,
        *,
        debug: bool = False,
        http: Any = None,
        store: Any = None,
        file_base_path: str | None = None,
    ) -> None:
        self.program = program
        self.tg = tg
        self.debug = debug
        self.http = http or RequestsHttpClient()
        self.store = store or get_db()
        self.file_base_path = _os.path.realpath(file_base_path or _os.getcwd())
        self.session_store = SessionRuntime(program.globals)
        self.effects: list[CoreEffect] = []

    def emit_effect(self, effect: CoreEffect) -> None:
        self.effects.append(effect)

    def resolve_chat_id(self, chat_id: int | None) -> int:
        resolved = _os.environ.get("DEFAULT_CHAT_ID") if chat_id in (None, "") else chat_id
        if resolved in (None, ""):
            raise conditions.CicadaRuntimeError("chat_id не задан для отправки сообщения")
        try:
            return int(resolved)
        except Exception:
            raise conditions.CicadaRuntimeError(f"chat_id не является числом: {resolved!r}")

    def evaluate(self, node: Any, ctx: Any) -> Any:
        strict = not self.debug
        try:
            return conditions.eval_expr(node, ctx, strict=strict)
        except conditions.CicadaUndefinedVariable as e:
            if self.debug:
                self.log("DEBUG", str(e), ctx)
                return ""
            raise conditions.enrich_error(e, ctx)
        except conditions.CicadaRuntimeError as e:
            raise conditions.enrich_error(e, ctx)
        except Exception as e:
            raise conditions.CicadaRuntimeError(f"Ошибка вычисления выражения: {e}")

    def evaluate_condition(self, cond: Any, ctx: Any) -> bool:
        return conditions.is_truthy(self.evaluate(cond, ctx))

    def resolve_value(self, val: Any, ctx: Any) -> Any:
        return self.evaluate(val, ctx)

    def render_parts(self, parts: list, ctx: Any) -> str:
        from cicada.parser import Literal

        def _unwrap(val):
            if isinstance(val, Literal):
                return val.value
            return val

        def _fmt_scalar(val):
            if val is None:
                return ""
            val = _unwrap(val)
            if isinstance(val, bool):
                return str(val)
            if isinstance(val, int):
                return str(val)
            if isinstance(val, float):
                return str(int(val)) if val.is_integer() else str(val)
            return str(val)

        def _fmt(val):
            if val is None:
                return ""
            val = _unwrap(val)
            if isinstance(val, list):
                return ", ".join(_fmt_scalar(x) for x in val)
            if isinstance(val, dict):
                return ", ".join(f"{_fmt_scalar(k)}={_fmt_scalar(v)}" for k, v in val.items())
            return _fmt_scalar(val)

        result: list[str] = []
        for part in parts:
            if isinstance(part, str):
                result.append(part)
            else:
                result.append(_fmt(self.evaluate(part, ctx)))
        return "".join(result)

    def render_template_string(self, template: str, ctx: Any) -> str:
        if not template or "{" not in template:
            return str(template)
        from cicada.parser import parse_string_expr

        try:
            parts = parse_string_expr(f'"{template}"')
            return self.render_parts(parts, ctx)
        except Exception:
            return self._template_fallback(template, ctx)

    def _template_fallback(self, template: str, ctx: Any) -> str:
        def repl(m: re.Match) -> str:
            name = m.group(1).strip()
            if name == "chat_id":
                return str(ctx.chat_id)
            if name == "user_id":
                return str(ctx.user_id)
            return m.group(0)

        return re.sub(r"\{([^}]+)\}", repl, template)

    def resolve_db_key(self, key: Any, ctx: Any) -> str:
        return storage.resolve_db_key(self, key, ctx)

    def resolve_file_path(self, path: Any, ctx: Any) -> str:
        return storage.resolve_file_path(self, path, ctx)

    def resolve_http_url(self, url: Any, ctx: Any) -> str:
        return storage.resolve_http_url(self, url, ctx)

    def get_http_headers(self, stmt_headers: dict, ctx: Any) -> dict:
        return storage.get_http_headers(self, stmt_headers, ctx)

    def resolve_http_data(self, data: Any, ctx: Any) -> Any:
        return storage.resolve_http_data(self, data, ctx)

    def log(self, level: str, message: str, ctx: Any | None = None) -> None:
        prefix = {"INFO": "[INFO] ", "DEBUG": "[DEBUG] ", "ERROR": "[ERROR] "}.get(level, "")
        user = f"[user:{ctx.chat_id}] " if ctx else ""
        print(f"[{level}] {prefix}{user}{message}")
