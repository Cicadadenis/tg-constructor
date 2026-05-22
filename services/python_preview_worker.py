#!/usr/bin/env python3
"""
JSON-lines preview worker for generated aiogram 3 bot.py modules.
Protocol: one request object per stdin line → one response object per stdout line.
"""
from __future__ import annotations

import asyncio
import hashlib
import importlib.util
import json
import re
import sys
import tempfile
from pathlib import Path
from typing import Any

# Валидный по формату Telegram token (не для реального API — только превью).
_PREVIEW_BOT_TOKEN = "1234567890:AAHdF6R-preview00000000000000000"

OUTBOUND: list[dict[str, Any]] = []
_SESSIONS: dict[str, dict[str, Any]] = {}


def _install_outbound_capture() -> None:
    try:
        from aiogram.types import Message, CallbackQuery
    except ImportError as exc:
        raise RuntimeError(
            "aiogram is not installed for preview. Create .venv-bot: pip install aiogram"
        ) from exc

    if getattr(Message, "_cicada_preview_patched", False):
        return

    async def capture_answer(self, text=None, *args, **kwargs):
        entry: dict[str, Any] = {"type": "send_message", "text": str(text or "")}
        markup = kwargs.get("reply_markup")
        if markup is not None:
            rows = getattr(markup, "inline_keyboard", None) or getattr(markup, "keyboard", None)
            if rows is not None:
                kb_rows: list[list[dict[str, Any]]] = []
                for row in rows:
                    kb_row: list[dict[str, Any]] = []
                    for btn in row:
                        kb_row.append(
                            {
                                "text": getattr(btn, "text", ""),
                                "callback_data": getattr(btn, "callback_data", None),
                                "url": getattr(btn, "url", None),
                            }
                        )
                    if kb_row:
                        kb_rows.append(kb_row)
                if getattr(markup, "inline_keyboard", None) is not None:
                    entry["type"] = "inline_keyboard"
                    entry["keyboard"] = kb_rows
                else:
                    entry["type"] = "reply_keyboard"
                    entry["keyboard"] = kb_rows
        OUTBOUND.append(entry)
        return None

    async def capture_callback_answer(self, text=None, *args, **kwargs):
        OUTBOUND.append({"type": "answer_callback", "text": str(text or "")})
        return True

    Message.answer = capture_answer  # type: ignore[method-assign]
    Message.reply = capture_answer  # type: ignore[method-assign]
    CallbackQuery.answer = capture_callback_answer  # type: ignore[method-assign]
    Message._cicada_preview_patched = True  # type: ignore[attr-defined]


def _build_message_update(chat_id: str, text: str) -> dict[str, Any]:
    cid = int(chat_id)
    uid = cid
    msg: dict[str, Any] = {
        "message_id": 1,
        "date": 0,
        "chat": {"id": cid, "type": "private"},
        "from": {"id": uid, "is_bot": False, "first_name": "Preview"},
        "text": text,
    }
    if text.startswith("/"):
        cmd = text.split()[0]
        msg["entities"] = [{"type": "bot_command", "offset": 0, "length": len(cmd)}]
    return {
        "update_id": 1,
        "message": msg,
    }


def _build_callback_update(chat_id: str, data: str) -> dict[str, Any]:
    cid = int(chat_id)
    uid = cid
    return {
        "update_id": 2,
        "callback_query": {
            "id": "preview_cb",
            "from": {"id": uid, "is_bot": False, "first_name": "Preview"},
            "chat_instance": "0",
            "data": data,
            "message": {
                "message_id": 1,
                "date": 0,
                "chat": {"id": cid, "type": "private"},
                "from": {"id": uid, "is_bot": False, "first_name": "Preview"},
                "text": "",
            },
        },
    }


def _code_for_preview(code: str) -> str:
    """Подменяем placeholder-токен, иначе aiogram 3 отклоняет YOUR_BOT_TOKEN при feed_update."""
    patched = re.sub(
        r"bot\s*=\s*Bot\(token=([^)]+)\)",
        f'bot = Bot(token={json.dumps(_PREVIEW_BOT_TOKEN)})',
        code,
        count=1,
    )
    return patched


async def _load_module(code: str):
    _install_outbound_capture()
    tmp = Path(tempfile.mkdtemp(prefix="cicada-preview-"))
    bot_path = tmp / "bot.py"
    bot_path.write_text(_code_for_preview(code), encoding="utf-8")
    spec = importlib.util.spec_from_file_location("cicada_preview_bot", bot_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("failed to load preview bot module")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    dp = getattr(mod, "dp", None)
    bot = getattr(mod, "bot", None)
    router = getattr(mod, "router", None)
    if dp is None or bot is None:
        raise RuntimeError("generated bot.py must define dp and bot")
    if router is not None:
        try:
            dp.include_router(router)
        except ValueError:
            # already included (hot reload same module name)
            pass
    return mod, dp, bot


async def _run_request(req: dict[str, Any]) -> dict[str, Any]:
    global OUTBOUND
    OUTBOUND = []

    code = str(req.get("code") or "")
    if not code.strip():
        return {"ok": False, "error": "empty code"}

    session_id = str(req.get("sessionId") or "default")
    chat_id = str(req.get("chatId") or "990000001")
    text = str(req.get("text") or "")
    callback_data = req.get("callbackData")
    caption = str(req.get("caption") or "")

    digest = hashlib.sha256(code.encode("utf-8")).hexdigest()
    cache_key = f"{session_id}:{digest}"
    if cache_key not in _SESSIONS:
        mod, dp, bot = await _load_module(code)
        _SESSIONS[cache_key] = {"mod": mod, "dp": dp, "bot": bot}
    ctx = _SESSIONS[cache_key]
    dp = ctx["dp"]
    bot = ctx["bot"]

    from aiogram.types import Update

    if callback_data:
        update = Update.model_validate(_build_callback_update(chat_id, str(callback_data)))
    elif text.startswith("/"):
        update = Update.model_validate(_build_message_update(chat_id, text))
    elif text:
        update = Update.model_validate(_build_message_update(chat_id, text))
    elif caption:
        update = Update.model_validate(_build_message_update(chat_id, caption))
    else:
        update = Update.model_validate(_build_message_update(chat_id, "/start"))

    await dp.feed_update(bot, update)

    return {"ok": True, "outbound": list(OUTBOUND), "effects": list(OUTBOUND)}


def _handle_line(line: str) -> None:
    line = line.strip()
    if not line:
        return
    try:
        req = json.loads(line)
        out = asyncio.run(_run_request(req))
    except Exception as exc:
        out = {"ok": False, "error": str(exc)}
    sys.stdout.write(json.dumps(out, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def main() -> None:
    for line in sys.stdin:
        _handle_line(line)


if __name__ == "__main__":
    main()
