# -*- coding: utf-8 -*-
from pathlib import Path
lines = Path("src/App.jsx").read_text(encoding="utf-8").splitlines()
for n in [2965, 2966, 2968, 2969, 2973, 2974, 2943, 2944, 197]:
    s = lines[n - 1]
    Path("scripts/hex_lines.txt").open("a", encoding="utf-8").write(
        f"\n=== {n} ===\n{s}\nrepr snippet: {repr(s[80:200] if len(s)>80 else s)}\n"
    )
