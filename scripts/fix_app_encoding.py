# -*- coding: utf-8 -*-
"""Fix UTF-8 mojibake (cp1251 misread) in App.jsx — quoted strings and JSX text."""
from __future__ import annotations

import re
from pathlib import Path

APP = Path("src/App.jsx")

MOJIBAKE_RUN = re.compile(
    r"[РС][\u0400-\u04FF\u2013\u2019\u201a\u2018\u2014]+|"
    r"рџ[\u0400-\u04FF]+|"
    r"в(?:њЁ|†|—|љЎ|љ |¦)"
)

MARKERS = ("Р\u2019", "Р\u2014", "Р—", "Рќ", "рџ", "вњ", "в†", "вљ", "Рњ", "Рў", "РЁ", "Рљ", "Р¤", "Рћ", "Рџ", "Р'", "Р±", "Рµ", "Рі", "Рґ", "Р»", "РЅ", "Рѕ", "РІ", "Р°", "Рё", "Рј", "РЅ", "Рї", "Рє", "РЎ", "Рў", "Р¦", "Р§", "РЁ", "Р©", "РЄ", "Р«", "Р¬", "Р­", "Р®", "РЇ")


def has_mojibake(s: str) -> bool:
    return any(m in s for m in MARKERS)


def fix_chunk(chunk: str) -> str:
    try:
        return chunk.encode("cp1251").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return chunk


def fix_text(s: str) -> str:
    if not has_mojibake(s):
        return s
    try:
        whole = s.encode("cp1251").decode("utf-8")
        if whole and "\ufffd" not in whole:
            return whole
    except (UnicodeEncodeError, UnicodeDecodeError):
        pass
    return MOJIBAKE_RUN.sub(lambda m: fix_chunk(m.group(0)), s)


def fix_quoted_strings(content: str) -> str:
    def repl(m: re.Match[str]) -> str:
        q, body = m.group(1), m.group(2)
        if not has_mojibake(body):
            return m.group(0)
        fixed = fix_text(body)
        return f"{q}{fixed}{q}" if fixed != body else m.group(0)

    return re.sub(r"(')((?:\\.|[^'\\])*)(')", repl, content)


def fix_jsx_text_nodes(content: str) -> str:
    def repl(m: re.Match[str]) -> str:
        inner = m.group(1)
        if "{" in inner or "}" in inner or not has_mojibake(inner):
            return m.group(0)
        fixed = fix_text(inner)
        return f">{fixed}<" if fixed != inner else m.group(0)

    return re.sub(r">([^<>]*?)<", repl, content)


def main() -> None:
    text = APP.read_text(encoding="utf-8")

    # Garbled login label after a partial repair
    text = re.sub(r">Войти[^<\n]{0,48}</button>", ">Войти</button>", text, count=1)

    for _ in range(4):
        prev = text
        text = fix_quoted_strings(text)
        text = fix_jsx_text_nodes(text)
        if text == prev:
            break

    APP.write_text(text, encoding="utf-8")
    remaining = sum(1 for line in text.splitlines() if has_mojibake(line))
    print(f"fixed {APP}, lines with possible mojibake left: {remaining}")


if __name__ == "__main__":
    main()
