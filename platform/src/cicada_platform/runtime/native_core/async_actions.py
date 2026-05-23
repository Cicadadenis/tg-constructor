"""Pure I/O side effects: HTTP, sleep, Telegram API, notify (NO orchestration).

This module must not import the graph control plane, IR schemas, or workflow routing.
Branching here is limited to error handling and payload shaping for a single op invocation.
"""

from __future__ import annotations

import json as _json
import time
from typing import TYPE_CHECKING

from cicada.parser import (
    Broadcast,
    CheckSubscription,
    DownloadFile,
    FetchJson,
    GetChatMemberRole,
    HttpDelete,
    HttpGet,
    HttpPatch,
    HttpPost,
    HttpPut,
    Notify,
    SetHttpHeaders,
    Sleep,
    TelegramAPI,
)

from cicada_platform.runtime.native_core.conditions import CicadaRuntimeError, CicadaTypeError
from cicada_platform.runtime.native_core import messaging, storage

if TYPE_CHECKING:
    from cicada_platform.runtime.native_core.base import NativeRuntime


def apply_download_file(rt: "NativeRuntime", stmt: DownloadFile, ctx) -> None:
    file_id = ctx.get("файл_id", "")
    if not file_id:
        raise CicadaRuntimeError("Ошибка скачивания: нет файл_id в контексте", stmt)
    try:
        rt.tg.download_file(file_id, stmt.save_path)
        ctx.set("скачан", stmt.save_path)
    except Exception as e:
        raise CicadaRuntimeError(f"Ошибка скачивания файла: {e}", stmt)


def apply_sleep(rt: "NativeRuntime", stmt: Sleep, ctx) -> None:
    time.sleep(stmt.seconds)


def apply_tg_api(rt: "NativeRuntime", stmt: TelegramAPI, ctx) -> None:
    try:
        rt.tg.call(stmt.method, stmt.params)
    except Exception as e:
        raise CicadaRuntimeError(f"Telegram API {stmt.method}: {e}", stmt)


def apply_notify(rt: "NativeRuntime", stmt: Notify, ctx) -> None:
    user_id = rt.resolve_value(stmt.user_id, ctx)
    text = rt.render_parts(stmt.parts, ctx)
    try:
        messaging.send_message(rt, int(user_id), text)
    except Exception as e:
        rt.log("ERROR", f"уведомить {user_id}: {e}", ctx)


def apply_broadcast(rt: "NativeRuntime", stmt: Broadcast, ctx) -> None:
    text = rt.render_parts(stmt.parts, ctx)
    recipients = storage.broadcast_recipient_ids(rt.store, stmt.segment)
    sent = 0
    for uid in recipients:
        try:
            messaging.send_message(rt, int(uid), text)
            sent += 1
        except Exception as e:
            rt.log("DEBUG", f"Рассылка: ошибка для {uid}: {e}", ctx)
    rt.log("INFO", f"Рассылка отправлена {sent} пользователям.", ctx)


def apply_check_subscription(rt: "NativeRuntime", stmt: CheckSubscription, ctx) -> None:
    channel = (
        rt.resolve_value(stmt.channel, ctx)
        if not isinstance(stmt.channel, str)
        else stmt.channel
    )
    user_id = int(ctx.user_id)
    try:
        result = rt.tg.get_chat_member(channel, user_id)
        status = result.get("result", {}).get("status", "left")
        is_sub = status in ("creator", "administrator", "member", "restricted")
        ctx.set(stmt.variable, is_sub)
    except Exception as e:
        rt.log("ERROR", f"проверить подписку {channel}: {e}", ctx)
        ctx.set(stmt.variable, False)


def apply_get_chat_member_role(rt: "NativeRuntime", stmt: GetChatMemberRole, ctx) -> None:
    chat = (
        rt.resolve_value(stmt.chat, ctx)
        if not isinstance(stmt.chat, str)
        else stmt.chat
    )
    user_id = rt.resolve_value(stmt.user_id, ctx)
    try:
        result = rt.tg.get_chat_member(chat, int(user_id))
        status = result.get("result", {}).get("status", "left")
        ctx.set(stmt.variable, status)
    except Exception as e:
        rt.log("ERROR", f"роль в {chat}: {e}", ctx)
        ctx.set(stmt.variable, "left")


def apply_set_http_headers(rt: "NativeRuntime", stmt: SetHttpHeaders, ctx) -> None:
    headers = ctx.get(stmt.variable)
    if not isinstance(headers, dict):
        raise CicadaTypeError(
            f"http_заголовки: переменная '{stmt.variable}' должна быть объектом (dict)."
        )
    ctx._http_headers = headers


def _http_request(
    rt: "NativeRuntime",
    stmt,
    ctx,
    *,
    method: str,
) -> None:
    url = rt.resolve_http_url(stmt.url, ctx)
    headers = rt.get_http_headers(getattr(stmt, "headers", None) or {}, ctx)
    try:
        if method == "get":
            resp = rt.http.get(url, headers=headers, timeout=30)
        elif method == "delete":
            resp = rt.http.delete(url, headers=headers, timeout=30)
        else:
            data = rt.resolve_http_data(stmt.data, ctx)
            fn = {"patch": rt.http.patch, "put": rt.http.put, "post": rt.http.post}[method]
            resp = _post_like(fn, url, data, headers)
        ctx.set(stmt.variable, resp.text)
    except Exception as e:
        ctx.set(stmt.variable, "")
        raise CicadaRuntimeError(f"HTTP {method.upper()} {url}: {e}", stmt)


def _post_like(fn, url: str, data, headers: dict):
    if isinstance(data, dict):
        return fn(url, json=data, headers=headers, timeout=30)
    return fn(url, data=str(data) if data is not None else None, headers=headers, timeout=30)


def apply_http_get(rt: "NativeRuntime", stmt: HttpGet, ctx) -> None:
    _http_request(rt, stmt, ctx, method="get")


def apply_http_post(rt: "NativeRuntime", stmt: HttpPost, ctx) -> None:
    _http_request(rt, stmt, ctx, method="post")


def apply_http_patch(rt: "NativeRuntime", stmt: HttpPatch, ctx) -> None:
    _http_request(rt, stmt, ctx, method="patch")


def apply_http_put(rt: "NativeRuntime", stmt: HttpPut, ctx) -> None:
    _http_request(rt, stmt, ctx, method="put")


def apply_http_delete(rt: "NativeRuntime", stmt: HttpDelete, ctx) -> None:
    _http_request(rt, stmt, ctx, method="delete")


def apply_fetch_json(rt: "NativeRuntime", stmt: FetchJson, ctx) -> None:
    url = rt.resolve_http_url(stmt.url, ctx)
    try:
        headers = rt.get_http_headers(stmt.headers, ctx)
        resp = rt.http.get(url, headers=headers, timeout=30)
        data = _json.loads(resp.text)
        ctx.set(stmt.variable, data)
    except _json.JSONDecodeError as e:
        ctx.set(stmt.variable, "")
        raise CicadaRuntimeError(f"fetch_json {url}: ошибка разбора JSON: {e}", stmt)
    except Exception as e:
        ctx.set(stmt.variable, "")
        raise CicadaRuntimeError(f"fetch_json {url}: {e}", stmt)
