#!/bin/bash
# Termux: установка Cicada Studio через setup.sh (ветка setup-termux-safe-final).
# LOCAL · AUTH_BYPASS=1 · DISABLE_FIRMWARE_RUNTIME=1 · без proot-distro.
# Не запускайте от root (exit из su) — скрипт сам перезапустится от пользователя Termux.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export WEBINSTALL_PLATFORM=termux
exec bash setup.sh "$@"
