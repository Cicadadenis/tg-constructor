#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENV="${ROOT}/.venv-esphome"

if [[ ! -d "${VENV}" ]]; then
  python3 -m venv "${VENV}"
fi
"${VENV}/bin/pip" install -U pip wheel
"${VENV}/bin/pip" install -U esphome
echo "ESPHome: $("${VENV}/bin/esphome" version)"
echo "Add to .env: ESPHOME_BIN=${VENV}/bin/esphome"
