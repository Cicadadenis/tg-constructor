# -*- coding: utf-8 -*-
from pathlib import Path

text = Path("src/App.jsx").read_text(encoding="utf-8")
lines = text.splitlines()

issues = []
for i, line in enumerate(lines, 1):
    if "\ufffd" in line:
        issues.append((i, "U+FFFD", line[:140]))
    if "\\n                  {label}" in line:
        issues.append((i, "literal_n", line[:140]))
    if "icon: '2Z" in line or "icon: '@_" in line:
        issues.append((i, "bad_icon", line.strip()[:140]))
    if "Р—Р°" in line or "РќР°С‡" in line:
        issues.append((i, "mojibake", line[:140]))
    if "вњЁ" in line or "в†'" in line:
        issues.append((i, "mojibake_emoji", line[:140]))

report = f"issues: {len(issues)}\n" + "\n".join(f"{n} [{t}] {p}" for n, t, p in issues[:80])
Path("scripts/scan_report.txt").write_text(report, encoding="utf-8")
print(report[:2000])
