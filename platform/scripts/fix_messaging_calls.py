from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src/cicada_platform/runtime/native_core/messaging.py"
t = p.read_text(encoding="utf-8")
fixes = [
    ("messaging.reset_pending(ctx)", "reset_pending(rt, ctx)"),
    ("messaging.flush_pending(ctx)", "flush_pending(rt, ctx)"),
    ("messaging.send_buttons_matrix(ctx.chat_id", "send_buttons_matrix(rt, ctx.chat_id"),
    ("messaging.send_message(ctx.chat_id", "send_message(rt, ctx.chat_id"),
    ("messaging.send_inline_keyboard(ctx.chat_id", "send_inline_keyboard(rt, ctx.chat_id"),
    ("messaging.send_media(ctx.chat_id", "send_media(rt, ctx.chat_id"),
    ("messaging.send_platform(", "send_platform(rt, "),
    ("messaging.send_formatted_text(ctx", "send_formatted_text(rt, ctx"),
    ("messaging.send_inline_items(", "send_inline_items(rt, "),
    ("messaging.apply_inline_keyboard(", "apply_inline_keyboard(rt, "),
]
for a, b in fixes:
    t = t.replace(a, b)
p.write_text(t, encoding="utf-8")
print("ok")
