# -*- coding: utf-8 -*-
from pathlib import Path

lines = Path("src/App.jsx").read_text(encoding="utf-8").splitlines()
for i in range(2935, 2990):
    print(f"{i+1}: {lines[i]}")

Path("scripts/landing_snippet.txt").write_text("\n".join(lines[2935:2990]), encoding="utf-8")
