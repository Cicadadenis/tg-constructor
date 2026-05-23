"""Inbound event → graph entry node resolution and dispatch."""

from __future__ import annotations

from typing import Any

from cicada_platform.runtime.control_plane.protocol import ControlPlaneHost
from cicada_platform.runtime.entry import (
    handlers_by_role,
    resolve_callback_entries,
    resolve_media_entries,
    resolve_message_entries,
)
from cicada_platform.runtime.trace import TraceEventKind


class GraphRouter:
    def __init__(self, host: ControlPlaneHost) -> None:
        self._host = host

    def handle_update(self, update: dict) -> None:
        if "callback_query" in update:
            self.handle_callback(update)
        elif "message" in update:
            self.handle_message(update)

    def run_entries(self, entry_nodes: list[str], ctx: Any) -> None:
        host = self._host
        for entry in entry_nodes:
            host.trace.emit(TraceEventKind.HANDLER_MATCHED, entry_node=entry)
            host.run_graph(entry, ctx)
            if getattr(ctx, "_return_requested", False):
                break

    def before_each(self, ctx: Any) -> None:
        for h in handlers_by_role(self._host.graph, "before_each"):
            self._host.run_graph(h.entry_node, ctx)

    def after_each(self, ctx: Any) -> None:
        for h in handlers_by_role(self._host.graph, "after_each"):
            self._host.run_graph(h.entry_node, ctx)

    def handle_callback(self, update: dict) -> None:
        host = self._host
        cq = update["callback_query"]
        msg = cq.get("message", {})
        chat_id = msg.get("chat", {}).get("id")
        if not chat_id:
            return
        ctx = self.make_ctx(update, msg, cq.get("from", {}))
        data = self.resolve_callback_data(cq.get("data", ""))
        ctx.set("кнопка", data)
        ctx.set("callback", data)
        ctx.set("текст", data)

        try:
            host.tg.answer_callback(cq.get("id", ""))
        except Exception:
            pass

        self.before_each(ctx)
        if getattr(ctx, "_return_requested", False):
            return

        if ctx.waiting_for:
            host.resume.resume_input(ctx, data)
            ctx._return_requested = False
            self.after_each(ctx)
            return

        entries = resolve_callback_entries(host.graph, data)
        if entries:
            self.run_entries(entries, ctx)
        else:
            text_entries = resolve_message_entries(host.graph, data)
            if text_entries:
                self.run_entries(text_entries, ctx)

        if ctx.scenario and getattr(ctx, "_transition_made", False):
            ctx._transition_made = False
            host.scenarios.continue_steps(ctx)

        ctx._return_requested = False
        self.after_each(ctx)

    def handle_message(self, update: dict) -> None:
        host = self._host
        msg = update["message"]
        ctx = self.make_ctx(update, msg, msg.get("from", {}))
        text = msg.get("text", "")

        self.before_each(ctx)
        if getattr(ctx, "_return_requested", False):
            return

        media_kind = self.detect_media(msg, ctx)
        if media_kind:
            answer = self.media_answer(media_kind, ctx)
            if ctx.waiting_for and answer is not None:
                host.resume.resume_input(ctx, answer)
                ctx._return_requested = False
                self.after_each(ctx)
                return
            entries = resolve_media_entries(host.graph, media_kind)
            self.run_entries(entries, ctx)
            return

        if ctx.waiting_for and text and not text.startswith("/"):
            host.resume.resume_input(ctx, text)
            ctx._return_requested = False
            self.after_each(ctx)
            return

        entries = resolve_message_entries(host.graph, text)
        self.run_entries(entries, ctx)

        ctx._return_requested = False
        self.after_each(ctx)

    def make_ctx(self, update: dict, msg: dict, user_info: dict) -> Any:
        chat_id = msg["chat"]["id"]
        ctx = self._host.services.user(
            chat_id,
            user_info.get("first_name", "") or user_info.get("username", ""),
            user_info.get("id"),
            user_info.get("last_name", ""),
            language_code=user_info.get("language_code", ""),
            chat_type=msg.get("chat", {}).get("type", "private"),
        )
        ctx._return_requested = False
        ctx.set("сообщение_id", msg.get("message_id", 0))
        ctx.set("текст", msg.get("text", ""))
        return ctx

    def resolve_callback_data(self, data: str) -> str:
        from cicada.security_utils import decode_callback_data  # type: ignore

        resolved = decode_callback_data(data)
        if resolved != data:
            return resolved
        return data

    def detect_media(self, msg: dict, ctx: Any) -> str | None:
        if msg.get("photo"):
            ctx.set("файл_id", msg["photo"][-1]["file_id"])
            ctx.set("тип_файла", "фото")
            return "photo_received"
        if msg.get("document"):
            ctx.set("файл_id", msg["document"]["file_id"])
            ctx.set("имя_файла", msg["document"].get("file_name", ""))
            ctx.set("тип_файла", "документ")
            return "document_received"
        if msg.get("voice"):
            ctx.set("файл_id", msg["voice"]["file_id"])
            ctx.set("тип_файла", "голосовое")
            return "voice_received"
        if msg.get("audio"):
            ctx.set("файл_id", msg["audio"]["file_id"])
            ctx.set("тип_файла", "аудио")
            return "voice_received"
        if msg.get("sticker"):
            ctx.set("файл_id", msg["sticker"]["file_id"])
            ctx.set("стикер_emoji", msg["sticker"].get("emoji", ""))
            ctx.set("тип_файла", "стикер")
            return "sticker_received"
        if msg.get("location"):
            loc = msg["location"]
            ctx.set("широта", str(loc["latitude"]))
            ctx.set("долгота", str(loc["longitude"]))
            ctx.set("тип_файла", "геолокация")
            return "location_received"
        if msg.get("contact"):
            c = msg["contact"]
            ctx.set("контакт_имя", c.get("first_name", ""))
            ctx.set("контакт_телефон", c.get("phone_number", ""))
            ctx.set("тип_файла", "контакт")
            return "contact_received"
        return None

    def media_answer(self, media_kind: str, ctx: Any) -> str | None:
        if media_kind in ("document_received", "photo_received", "voice_received", "sticker_received"):
            fid = ctx.get("файл_id")
            return str(fid) if fid not in (None, "") else None
        if media_kind == "location_received":
            lat, lon = ctx.get("широта"), ctx.get("долгота")
            if lat in (None, "") or lon in (None, ""):
                return None
            return f"{lat},{lon}"
        if media_kind == "contact_received":
            phone = ctx.get("контакт_телефон")
            if phone not in (None, ""):
                return str(phone)
            name = ctx.get("контакт_имя")
            return str(name) if name not in (None, "") else None
        return None
