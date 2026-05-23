#!/bin/bash
# Termux: установка Cicada Studio (LOCAL, без входа — AUTH_BYPASS=1 в .env)
# ESPHome / сборка прошивок отключены (DISABLE_FIRMWARE_RUNTIME=1).
# Основано на рабочем setup.sh; не запускайте от root (exit из su).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
exec bash setup.sh "$@"
