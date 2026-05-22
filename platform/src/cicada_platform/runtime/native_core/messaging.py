"""Outbound messaging effects (NO orchestration)."""

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
    Ask,
    Buttons,
    ForwardMsg,
    ForwardPhoto,
    InlineButton,
    InlineKeyboard,
    InlineKeyboardFromDB,
    InlineKeyboardFromList,
    Photo,
    PhotoVar,
    Reply,
    SendAudio,
    SendContact,
    SendDocument,
    SendGame,
    SendHTML,
    SendInvoice,
    SendLocation,
    SendMarkdown,
    SendMarkdownV2,
    SendPoll,
    SendVideo,
    SendVoice,
    Sticker,
)
from cicada.security_utils import encode_callback_data
from cicada.core import (
    ButtonsEffect,
    CoreEffect,
    InlineKeyboardEffect,
    MediaEffect,
    MessageEffect,
    PlatformEffect,
)

def send_message(rt: "NativeRuntime", chat_id: int | None, text: str, **kwargs):
        resolved_chat = rt.resolve_chat_id(chat_id)
        rt.emit_effect(MessageEffect(resolved_chat, text))
        return rt.tg.send_message(resolved_chat, text, **kwargs)


def send_buttons_matrix(rt: "NativeRuntime", chat_id: int | None, matrix: list, text: str = None):
        resolved_chat = rt.resolve_chat_id(chat_id)
        rt.emit_effect(ButtonsEffect(resolved_chat, text if text is not None else " ", matrix))
        return rt.tg.send_buttons_matrix(resolved_chat, matrix, text=text)


def send_inline_keyboard(rt: "NativeRuntime", chat_id: int | None, keyboard: list, text: str = "\u200b"):
        resolved_chat = rt.resolve_chat_id(chat_id)
        rt.emit_effect(InlineKeyboardEffect(resolved_chat, text, keyboard))
        return rt.tg.send_inline_keyboard(resolved_chat, keyboard, text=text)


def send_media(rt: "NativeRuntime", chat_id: int | None, media_type: str, file: str, caption: str = ""):
        """
        Отправка медиа (photo/document/video/voice/sticker).
        Если chat_id не передан — пытаемся взять из окружения `DEFAULT_CHAT_ID`.
        Если chat_id всё ещё не задан — выдаём подробную ошибку.
        """
        resolved_chat = rt.resolve_chat_id(chat_id)
        rt.emit_effect(MediaEffect(resolved_chat, media_type, file, caption))
        method = getattr(rt.tg, f"send_{media_type}")
        if media_type == "sticker":
            return method(resolved_chat, file)
        return method(resolved_chat, file, caption)


def send_platform(rt: "NativeRuntime", kind: str, chat_id: int | None = None, **payload):
        rt.emit_effect(PlatformEffect(kind, chat_id, **payload))


def reset_pending(rt: "NativeRuntime", ctx):
        """Гарантирует структуру _pending_message ВСЕГДА"""
        if getattr(ctx, "_pending_message", None) is None:
            ctx._pending_message = {
                "text": "",
                "buttons": None
            }


def flush_pending(rt: "NativeRuntime", ctx):
        """Единая точка отправки накопленного сообщения"""
        msg = getattr(ctx, "_pending_message", None)
        if not msg:
            return

        text = msg.get("text", "") or ""
        buttons = msg.get("buttons")

        if buttons:
            if not text.strip():
                text = "\u200b"
            send_buttons_matrix(rt, ctx.chat_id, buttons, text=text)
        elif text.strip():
            send_message(rt, ctx.chat_id, text)

        ctx._pending_message = None


def apply_reply(rt: "NativeRuntime", stmt: Reply, ctx):
        reset_pending(rt, ctx)
        text = rt.render_parts(stmt.parts, ctx)

        existing = ctx._pending_message.get("text", "")
        if existing:
            sep = "\n" if not existing.endswith("\n") else ""
            ctx._pending_message["text"] = existing + sep + text
        else:
            ctx._pending_message["text"] = text


def apply_random_reply(rt: "NativeRuntime", stmt, ctx):
        import random as _random
        variant = _random.choice(stmt.variants)
        reset_pending(rt, ctx)
        existing = ctx._pending_message.get("text", "")
        if existing:
            sep = "\n" if not existing.endswith("\n") else ""
            ctx._pending_message["text"] = existing + sep + variant
        else:
            ctx._pending_message["text"] = variant


def apply_ask(rt: "NativeRuntime", stmt: Ask, ctx):
        flush_pending(rt, ctx)  # отправляем накопленное перед вопросом
        # Буферим вопрос вместо прямой отправки
        ctx._pending_message = {
            "text": stmt.question,
            "buttons": None
        }
        ctx.waiting_for = stmt.variable
        ctx._ask_sent = True  # buffered until outbound flush by control plane


def apply_photo_var(rt: "NativeRuntime", stmt: PhotoVar, ctx):
        """Отправить картинку по URL/file_id/BytesIO из переменной"""
        from io import BytesIO as _BytesIO
        photo = ctx.get(stmt.var_name, "")
        if photo is not None and photo != "":
            if not isinstance(photo, _BytesIO):
                photo = str(photo)
            send_media(rt, ctx.chat_id, "photo", photo)
        else:
            send_message(rt, ctx.chat_id, "⚠️ Фото не задано")

    # ── Циклы ─────────────────────────────────────────────────────────


def apply_buttons(rt: "NativeRuntime", stmt: Buttons, ctx):
        from cicada.parser import Literal as CicadaLiteral, Variable

        def _unwrap(v):
            if isinstance(v, CicadaLiteral):
                return str(v.value)
            if isinstance(v, Variable):
                return str(rt._eval(v, ctx))
            return str(v)

        new_rows = (
            [[_unwrap(lbl) for lbl in row] for row in stmt.labels]
            if stmt.labels and isinstance(stmt.labels[0], list)
            else [[_unwrap(lbl) for lbl in stmt.labels]]
        )
        existing = ctx._pending_message.get("buttons") or []
        ctx._pending_message["buttons"] = existing + new_rows


def apply_inline_button(rt: "NativeRuntime", stmt: InlineButton, ctx):
        """
        Одиночная inline-кнопка (устаревший путь — «кнопка "X" -> "cb"»).
        Оборачиваем в InlineKeyboard с одним рядом из одной кнопки
        и делегируем в _exec_inline_keyboard.
        """
        apply_inline_keyboard(rt, InlineKeyboard(rows=[[stmt]]), ctx)



def apply_inline_keyboard_from_list(rt: "NativeRuntime", stmt: InlineKeyboardFromList, ctx):
        items = rt._eval(stmt.items_expr, ctx)
        if not isinstance(items, list):
            raise CicadaTypeError("inline-кнопки из списка: ожидается список items.")

        back_text = stmt.back_text or ("🔙 Назад" if stmt.append_back else "")
        back_callback = stmt.back_callback or ("back" if stmt.append_back else "")
        send_inline_items(rt, 
            items,
            ctx,
            text_field=stmt.text_field,
            id_field=stmt.id_field,
            text_template=stmt.text_template,
            callback_template=stmt.callback_template,
            callback_prefix=stmt.callback_prefix,
            columns=stmt.columns,
            back_text=back_text,
            back_callback=back_callback,
        )


def apply_inline_keyboard_from_db(rt: "NativeRuntime", stmt: InlineKeyboardFromDB, ctx):
        key = rt.resolve_db_key(stmt.key, ctx)
        if rt.debug:
            print(f"[STATE] loading key={key!r} user_id={ctx.user_id}")
        items = rt.store.get(str(ctx.user_id), key)
        if items is None:
            items = rt.store.get_global(key)
        if items in (None, ""):
            items = []
        if not isinstance(items, list):
            raise CicadaTypeError(f"inline из бд: ключ '{key}' должен содержать список.")

        send_inline_items(rt, 
            items,
            ctx,
            text_field=stmt.text_field,
            id_field=stmt.id_field,
            callback_prefix=stmt.callback_prefix,
            columns=stmt.columns,
            back_text=stmt.back_text,
            back_callback=stmt.back_callback,
        )


def send_inline_items(
        rt: "NativeRuntime",
        items: list,
        ctx,
        *,
        text_field: str,
        id_field: str,
        text_template: str = "",
        callback_template: str = "",
        callback_prefix: str,
        columns: int,
        back_text: str = "",
        back_callback: str = "",
    ):
        flat_buttons = []
        for item in items:
            if text_template:
                text = render_item_template(text_template, item)
            elif isinstance(item, dict):
                text = str(item.get(text_field, ""))
            else:
                text = str(item)
            if callback_template:
                callback = render_item_template(callback_template, item)
            elif isinstance(item, dict):
                item_id = item.get(id_field, text)
                callback = f"{callback_prefix}{item_id}"
            else:
                callback = f"{callback_prefix}{item}"
            if not text:
                continue
            flat_buttons.append(InlineButton(text=text, callback=callback))

        if back_text and back_callback:
            flat_buttons.append(InlineButton(text=back_text, callback=back_callback))

        cols = max(1, int(columns or 1))
        rows = [flat_buttons[i:i + cols] for i in range(0, len(flat_buttons), cols)]
        if rows:
            apply_inline_keyboard(rt, InlineKeyboard(rows=rows), ctx)


def apply_inline_keyboard(rt: "NativeRuntime", stmt: InlineKeyboard, ctx):
        """
        Inline-клавиатура из блока inline-кнопки:
            ["Да" → "cb_yes", "Нет" → "cb_no"]
            ["Отмена" → "cb_cancel"]
        Отправляется ВМЕСТЕ с накопленным текстом в одном сообщении.
        """
        # Строим матрицу кнопок для Telegram InlineKeyboardMarkup
        keyboard = []
        for row in stmt.rows:
            kb_row = []
            for btn in row:
                if btn.url:
                    kb_row.append({"text": btn.text, "url": btn.url})
                else:
                    kb_row.append({
                        "text": btn.text,
                        "callback_data": encode_callback_data(btn.callback or btn.text),
                    })
            if kb_row:
                keyboard.append(kb_row)
        if not keyboard:
            return

        # Забираем накопленный текст — отправим ВМЕСТЕ с клавиатурой в одном сообщении
        msg = getattr(ctx, "_pending_message", None) or {}
        pending_text = (msg.get("text", "") or "").strip()
        pending_buttons = msg.get("buttons")

        if pending_buttons:
            # Если есть накопленные reply-кнопки — флашим их отдельно
            flush_pending(rt, ctx)
            pending_text = ""
        else:
            # Потребляем накопленный текст, чтобы финальный _flush не дублировал его
            ctx._pending_message = None

        send_inline_keyboard(rt, ctx.chat_id, keyboard, text=pending_text or "\u200b")


def apply_photo(rt: "NativeRuntime", stmt: Photo, ctx):
        send_media(rt, ctx.chat_id, "photo", stmt.url)


def apply_sticker(rt: "NativeRuntime", stmt: Sticker, ctx):
        file_id = eval_expr(stmt.file_id, ctx) if not isinstance(stmt.file_id, str) else stmt.file_id
        send_media(rt, ctx.chat_id, "sticker", str(file_id))


def apply_forward_photo(rt: "NativeRuntime", stmt: ForwardPhoto, ctx):
        file_id = ctx.get("файл_id", "")
        if file_id:
            send_media(rt, ctx.chat_id, "photo", file_id, caption=stmt.caption)
        else:
            send_message(rt, ctx.chat_id, "⚠️ Нет фото для пересылки")


def apply_send_markdown(rt: "NativeRuntime", stmt: SendMarkdown, ctx):
        send_formatted_text(rt, ctx, stmt.parts, "markdown", "send_markdown")


def apply_send_html(rt: "NativeRuntime", stmt: SendHTML, ctx):
        send_formatted_text(rt, ctx, stmt.parts, "html", "send_html")


def apply_send_markdown_v2(rt: "NativeRuntime", stmt: SendMarkdownV2, ctx):
        send_formatted_text(rt, ctx, stmt.parts, "markdown_v2", "send_markdown_v2")


def send_formatted_text(rt: "NativeRuntime", ctx, parts: list, kind: str, method_name: str):
        text = rt.render_parts(parts, ctx)
        # Use resolved chat id (fallback to DEFAULT_CHAT_ID)
        resolved_chat = rt.resolve_chat_id(getattr(ctx, "chat_id", None))
        send_platform(rt, kind, resolved_chat, text=text)
        getattr(rt.tg, method_name)(resolved_chat, text)


def apply_send_document(rt: "NativeRuntime", stmt: SendDocument, ctx):
        from io import BytesIO as _BytesIO
        file = eval_expr(stmt.file, ctx) if not isinstance(stmt.file, str) else stmt.file
        if not isinstance(file, _BytesIO):
            file = str(file)
        send_media(rt, ctx.chat_id, "document", file, stmt.caption)


def apply_send_audio(rt: "NativeRuntime", stmt: SendAudio, ctx):
        from io import BytesIO as _BytesIO
        file = eval_expr(stmt.file, ctx) if not isinstance(stmt.file, str) else stmt.file
        if not isinstance(file, _BytesIO):
            file = str(file)
        send_media(rt, ctx.chat_id, "audio", file, stmt.caption)


def apply_send_video(rt: "NativeRuntime", stmt: SendVideo, ctx):
        from io import BytesIO as _BytesIO
        file = eval_expr(stmt.file, ctx) if not isinstance(stmt.file, str) else stmt.file
        if not isinstance(file, _BytesIO):
            file = str(file)
        send_media(rt, ctx.chat_id, "video", file, stmt.caption)


def apply_send_voice(rt: "NativeRuntime", stmt: SendVoice, ctx):
        from io import BytesIO as _BytesIO
        file = eval_expr(stmt.file, ctx) if not isinstance(stmt.file, str) else stmt.file
        if not isinstance(file, _BytesIO):
            file = str(file)
        send_media(rt, ctx.chat_id, "voice", file, stmt.caption)


def apply_send_location(rt: "NativeRuntime", stmt: SendLocation, ctx):
        resolved_chat = rt.resolve_chat_id(getattr(ctx, "chat_id", None))
        send_platform(rt, "location", resolved_chat, latitude=stmt.latitude, longitude=stmt.longitude)
        rt.tg.send_location(resolved_chat, stmt.latitude, stmt.longitude)


def apply_send_contact(rt: "NativeRuntime", stmt: SendContact, ctx):
        resolved_chat = rt.resolve_chat_id(getattr(ctx, "chat_id", None))
        send_platform(rt, "contact", resolved_chat, phone=stmt.phone, name=stmt.name)
        rt.tg.send_contact(resolved_chat, stmt.phone, stmt.name)


def apply_send_poll(rt: "NativeRuntime", stmt: SendPoll, ctx):
        send_platform(rt, "poll", ctx.chat_id, question=stmt.question, options=stmt.options)
        rt.tg.send_poll(ctx.chat_id, stmt.question, stmt.options)


def apply_send_invoice(rt: "NativeRuntime", stmt: SendInvoice, ctx):
        send_platform(rt, "invoice", ctx.chat_id, title=stmt.title, description=stmt.description, amount=stmt.amount)
        rt.tg.send_invoice(ctx.chat_id, stmt.title, stmt.description, stmt.amount)


def apply_send_game(rt: "NativeRuntime", stmt: SendGame, ctx):
        send_platform(rt, "game", ctx.chat_id, short_name=stmt.short_name)
        rt.tg.send_game(ctx.chat_id, stmt.short_name)


def apply_forward_msg(rt: "NativeRuntime", stmt: ForwardMsg, ctx):
        """переслать сообщение USER_ID — пересылает текущее сообщение."""
        to_id    = rt.resolve_value(stmt.to_user_id, ctx)
        msg_id   = ctx.get("сообщение_id", 0)
        from_id  = ctx.chat_id
        try:
            rt.tg.forward_message(int(to_id), from_id, int(msg_id))
        except Exception as e:
            rt.log("ERROR", f"переслать сообщение {to_id}: {e}", ctx)

    # ── Файлы и JSON ─────────────────────────────────────────────────
