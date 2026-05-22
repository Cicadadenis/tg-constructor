"""Fix auto-split native domain modules."""

from __future__ import annotations

import re
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "src" / "cicada_platform" / "runtime" / "native_core"

CORE_IMPORTS = """from cicada.core import (
    ButtonsEffect,
    CoreEffect,
    InlineKeyboardEffect,
    MediaEffect,
    MessageEffect,
    PlatformEffect,
)
"""

REPLACEMENTS = [
    (r"def (\w+)\(rt, self,", r'def \1(rt: "NativeRuntime",'),
    ("rt._emit_effect", "rt.emit_effect"),
    ("rt._resolve_chat_id", "rt.resolve_chat_id"),
    ("rt._render_parts", "rt.render_parts"),
    ("rt._resolve_val", "rt.resolve_value"),
    ("rt._log", "rt.log"),
    ("rt._resolve_db_key", "rt.resolve_db_key"),
    ("rt._resolve_file_path", "rt.resolve_file_path"),
    ("rt._resolve_http_url", "rt.resolve_http_url"),
    ("rt._get_http_headers", "rt.get_http_headers"),
    ("rt._resolve_http_data", "rt.resolve_http_data"),
    ("rt._send_message", "messaging.send_message"),
    ("rt._send_buttons_matrix", "messaging.send_buttons_matrix"),
    ("rt._send_inline_keyboard", "messaging.send_inline_keyboard"),
    ("rt._send_media", "messaging.send_media"),
    ("rt._send_platform", "messaging.send_platform"),
    ("rt._reset_pending", "messaging.reset_pending"),
    ("rt._flush", "messaging.flush_pending"),
    ("rt._send_formatted_text", "messaging.send_formatted_text"),
    ("rt._send_inline_items", "messaging.send_inline_items"),
    ("rt._exec_inline_keyboard", "messaging.apply_inline_keyboard"),
    ("raise _BreakSignal()", "raise LoopBreak()"),
    ("raise _ContinueSignal()", "raise LoopContinue()"),
]

for name in ("messaging", "flow_control", "storage", "async_actions"):
    path = OUT / f"{name}.py"
    text = path.read_text(encoding="utf-8")
    text = text.replace(
        '"""' + {
            "messaging": "Outbound messaging effects",
            "flow_control": "Variable and control-effect primitives",
            "storage": "Persistence and structured data effects",
            "async_actions": "I/O and side-effect actions",
        }[name]
        + ' — graph-native effect primitives."""',
        f'"""{name} — graph-native effect primitives (node → effect)."""',
    )
    for old, new in REPLACEMENTS:
        if old.startswith("def "):
            text = re.sub(old, new, text)
        else:
            text = text.replace(old, new)
    if name == "messaging" and "from cicada.core" not in text:
        text = text.replace(
            "from cicada.security_utils import encode_callback_data\n",
            "from cicada.security_utils import encode_callback_data\n" + CORE_IMPORTS,
        )
    if name == "flow_control":
        text = text.replace(
            "from cicada_platform.runtime.native_core.conditions import (\n",
            "from cicada_platform.runtime.native_core.conditions import (\n    LoopBreak,\n    LoopContinue,\n",
        )
    path.write_text(text, encoding="utf-8")
    print("fixed", name)
