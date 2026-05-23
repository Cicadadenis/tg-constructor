# -*- coding: utf-8 -*-
from pathlib import Path

path = Path("src/App.jsx")
lines = path.read_text(encoding="utf-8").splitlines()

bad = []
for i, line in enumerate(lines, 1):
    if "\u0420\u2014" in line or "\u0420\u2019" in line:
        bad.append((i, line[:100]))
    elif "рџ" in line:
        bad.append((i, line[:100]))
    elif "вњ" in line or "в†" in line:
        bad.append((i, line[:100]))
    elif "Р—Р" in line or "РќР" in line:
        bad.append((i, line[:100]))

print(f"bad lines: {len(bad)}")
for i, preview in bad[:25]:
    print(i, preview)
