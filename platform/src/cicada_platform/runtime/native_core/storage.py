"""Persistence effects — DB, files, HTTP payload helpers (NO orchestration)."""

from __future__ import annotations

import json as _json
import os as _os
import re
import time
from typing import TYPE_CHECKING

from cicada_platform.runtime.native_core.conditions import (
    CicadaRuntimeError,
    CicadaTypeError,
    eval_expr,
    render_item_template,
)

if TYPE_CHECKING:
    from cicada_platform.runtime.native_core.base import NativeRuntime

from cicada.parser import (
    DeleteDictKey,
    DeleteFile,
    DeleteFromDB,
    GetAllDBKeys,
    LoadFromDB,
    LoadFromUserDB,
    LoadJson,
    ParseJson,
    SaveGlobalDB,
    SaveJson,
    SaveToDB,
    SetDictKey,
)
from cicada.security_utils import resolve_path_under_base, validate_http_url


def resolve_db_key(rt: "NativeRuntime", key, ctx) -> str:
    if isinstance(key, str):
        return rt.render_template_string(key, ctx)
    return str(rt.resolve_value(key, ctx))


def apply_save_to_db(rt: "NativeRuntime", stmt: SaveToDB, ctx):
        value = rt.resolve_value(stmt.value, ctx)
        key = rt.resolve_db_key(stmt.key, ctx)
        if rt.debug:
            print(f"[STATE] saving key={key!r} user_id={ctx.user_id}")
        rt.store.set(str(ctx.user_id), key, value)


def apply_load_from_db(rt: "NativeRuntime", stmt: LoadFromDB, ctx):
        key = rt.resolve_db_key(stmt.key, ctx)
        if rt.debug:
            print(f"[STATE] loading key={key!r} user_id={ctx.user_id}")
        value = rt.store.get(str(ctx.user_id), key)
        if value is None:
            value = rt.store.get_global(key)
        ctx.set(stmt.variable, value if value is not None else "")


def apply_load_json(rt: "NativeRuntime", stmt: LoadJson, ctx):
        """json_файл "путь" → переменная."""
        try:
            path = rt.resolve_file_path(stmt.path, ctx)
            with open(path, "r", encoding="utf-8") as f:
                ctx.set(stmt.variable, _json.load(f))
        except FileNotFoundError:
            raise CicadaRuntimeError("json_файл: файл не найден", stmt)
        except ValueError as e:
            raise CicadaRuntimeError(f"json_файл: {e}", stmt)
        except _json.JSONDecodeError as e:
            raise CicadaRuntimeError(f"json_файл: ошибка разбора JSON: {e}", stmt)


def apply_parse_json(rt: "NativeRuntime", stmt: ParseJson, ctx):
        """разобрать_json источник → переменная."""
        source = rt.resolve_value(stmt.source, ctx)
        if isinstance(source, (dict, list)):
            ctx.set(stmt.variable, source)
            return
        try:
            data = _json.loads(str(source))
        except _json.JSONDecodeError as e:
            raise CicadaRuntimeError(f"разобрать_json: ошибка разбора JSON: {e}", stmt)
        ctx.set(stmt.variable, data)


def apply_save_json(rt: "NativeRuntime", stmt: SaveJson, ctx):
        """сохранить_json "путь" = переменная."""
        data = ctx.get(stmt.source_var)
        try:
            path = rt.resolve_file_path(stmt.path, ctx)
            with open(path, "w", encoding="utf-8") as f:
                _json.dump(data, f, ensure_ascii=False, indent=2)
        except ValueError as e:
            raise CicadaRuntimeError(f"сохранить_json: {e}", stmt)
        except Exception as e:
            raise CicadaRuntimeError(f"сохранить_json: ошибка записи: {e}", stmt)


def apply_delete_file(rt: "NativeRuntime", stmt: DeleteFile, ctx):
        """удалить_файл "путь"."""
        try:
            path = rt.resolve_file_path(stmt.path, ctx)
            _os.remove(path)
        except FileNotFoundError:
            rt.log("DEBUG", "удалить_файл: файл не найден", ctx)
        except ValueError as e:
            raise CicadaRuntimeError(f"удалить_файл: {e}", stmt)
        except Exception as e:
            raise CicadaRuntimeError(f"удалить_файл: {e}", stmt)


def apply_delete_dict_key(rt: "NativeRuntime", stmt: DeleteDictKey, ctx):
        """удалить объект["ключ"]."""
        obj = ctx.get(stmt.target)
        if not isinstance(obj, dict):
            raise CicadaTypeError(f"удалить ключ: '{stmt.target}' не является объектом.")
        key = rt.resolve_value(stmt.key, ctx) if not isinstance(stmt.key, str) else stmt.key
        obj.pop(str(key), None)
        ctx.set(stmt.target, obj)


def apply_set_dict_key(rt: "NativeRuntime", stmt: SetDictKey, ctx):
        """объект["ключ"] = значение."""
        obj = ctx.get(stmt.target)
        if obj is None:
            obj = {}
        if not isinstance(obj, dict):
            raise CicadaTypeError(f"присваивание поля: '{stmt.target}' не является объектом.")
        key   = rt.resolve_value(stmt.key, ctx)   if not isinstance(stmt.key, str)   else stmt.key
        value = rt.resolve_value(stmt.value, ctx)
        obj[str(key)] = value
        ctx.set(stmt.target, obj)

def broadcast_recipient_ids(store, segment: str | None) -> list[str]:
    """Data helper: recipient list for Broadcast op (filtering is I/O prep, not graph control)."""
    all_ids = store.get_all_user_ids()
    if not segment:
        return list(all_ids)
    return [uid for uid in all_ids if store.get(uid, "_сегмент") == segment]


def resolve_http_url(rt: "NativeRuntime", url, ctx) -> str:
    if isinstance(url, str):
        resolved = rt.render_template_string(url, ctx)
    else:
        resolved = str(rt.resolve_value(url, ctx))
    return validate_http_url(resolved)


def resolve_file_path(rt: "NativeRuntime", path, ctx) -> str:
    if isinstance(path, str):
        raw = rt.render_template_string(path, ctx) if ("{" in path or "}" in path) else path
    else:
        raw = str(rt.resolve_value(path, ctx))
    return resolve_path_under_base(rt.file_base_path, str(raw))


def get_http_headers(rt: "NativeRuntime", stmt_headers: dict, ctx) -> dict:
        """Возвращает объединённые заголовки: ctx._http_headers + заголовки инструкции."""
        base = dict(getattr(ctx, "_http_headers", {}) or {})
        base.update(stmt_headers or {})
        return base


def resolve_http_data(rt: "NativeRuntime", data, ctx):
    resolved = rt.resolve_value(data, ctx)
    if isinstance(resolved, str):
        return rt.render_template_string(resolved, ctx)
    return resolved


def apply_delete_from_db(rt: "NativeRuntime", stmt: DeleteFromDB, ctx):
        """удалить "ключ" — удаление ключа из БД."""
        key = rt.resolve_db_key(stmt.key, ctx)
        rt.store.delete(str(ctx.user_id), str(key))


def apply_get_all_db_keys(rt: "NativeRuntime", stmt: GetAllDBKeys, ctx):
        """все_ключи → список — все ключи пользователя в БД."""
        keys = rt.store.get_all_keys(str(ctx.user_id))
        ctx.set(stmt.variable, keys)


def apply_save_global_db(rt: "NativeRuntime", stmt: SaveGlobalDB, ctx):
        """сохранить_глобально "ключ" = значение."""
        key   = rt.resolve_db_key(stmt.key, ctx)
        value = rt.resolve_value(stmt.value, ctx)
        if rt.debug:
            print(f"[STATE] saving key={key!r} user_id={ctx.user_id}")
        rt.store.set_global(str(key), value)


def apply_load_from_user_db(rt: "NativeRuntime", stmt: LoadFromUserDB, ctx):
        """получить от USER_ID "ключ" → переменная."""
        uid   = rt.resolve_value(stmt.user_id, ctx)
        key   = rt.resolve_db_key(stmt.key, ctx)
        if rt.debug:
            print(f"[STATE] loading key={key!r} user_id={uid}")
        value = rt.store.get(str(uid), str(key))
        ctx.set(stmt.variable, value if value is not None else "")

    # ── Управление потоком расширения ──────────────────────────────────
