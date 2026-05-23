#!/bin/bash
set -euo pipefail
# Для отладки: DEBUG=1 bash setup.sh

# apt/debconf без TTY (webinstall, SSH, CI) — иначе «debconf: unable to initialize frontend: Dialog»
export DEBIAN_FRONTEND="${DEBIAN_FRONTEND:-noninteractive}"
export DEBCONF_NONINTERACTIVE_SEEN=true
export NEEDRESTART_MODE=a

# ═══════════════════════════════════════════════════════════════
#   CICADA STUDIO — ULTRA PROD BOOTSTRAP
#   Автоустановка всего необходимого с нуля
#   Платформы: VPS (Ubuntu/Debian) · WSL · Termux
# ═══════════════════════════════════════════════════════════════

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
WHITE='\033[1;37m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'
ORANGE='\033[38;5;208m'
VIOLET='\033[38;5;141m'
TEAL='\033[38;5;45m'
GRAY='\033[38;5;240m'
BG_DARK='\033[48;5;235m'

ui_init() {
  if [ -n "${NO_COLOR:-}" ] || [ ! -t 1 ]; then
    RED='' GREEN='' YELLOW='' CYAN='' BLUE='' MAGENTA='' WHITE='' DIM='' BOLD='' NC=''
    ORANGE='' VIOLET='' TEAL='' GRAY='' BG_DARK=''
  fi
}
ui_init

UI_COLS=80
UI_NARROW=0
UI_INNER=54

ui_term_cols() {
  local c="${COLUMNS:-}"
  if [ -z "$c" ] || ! [ "$c" -gt 0 ] 2>/dev/null; then
    c=$(tput cols 2>/dev/null || true)
  fi
  if [ -z "$c" ] || ! [ "$c" -gt 0 ] 2>/dev/null; then
    c=80
  fi
  echo "$c"
}

ui_refresh_layout() {
  UI_COLS=$(ui_term_cols)
  if [ "${PLATFORM:-}" = "termux" ] || [ "$UI_COLS" -lt 56 ]; then
    UI_NARROW=1
    UI_INNER=30
  else
    UI_NARROW=0
    UI_INNER=54
  fi
}

ui_repeat() {
  local ch=$1 n=$2 i=''
  [ "$n" -lt 1 ] && n=1
  while [ "${#i}" -lt "$n" ]; do i="${i}${ch}"; done
  printf '%s' "${i:0:$n}"
}

ui_shorten() {
  local s=$1 max=${2:-42}
  local home="${HOME:-}"
  if [ -n "$home" ]; then
    s="${s/#${home}/~}"
  fi
  if [ "${#s}" -le "$max" ]; then
    echo "$s"
    return
  fi
  echo "${s:0:$((max - 1))}…"
}

# ─── Перехват необработанных ошибок ────────────────────────────
# При set -e любая команда без || обрывает скрипт — trap покажет где именно
_trap_err() {
  local code=$? line=$1
  echo -e "\n  ${RED}✖  ${BOLD}Необработанная ошибка${NC} ${RED}(exit ${code})${NC}"
  echo -e "  ${GRAY}╰╴ Строка ${line} в ${BASH_SOURCE[1]:-setup.sh}${NC}"
  echo -e "  ${YELLOW}▲  Запусти с DEBUG=1 bash setup.sh для подробностей${NC}\n"
  exit "$code"
}
trap '_trap_err $LINENO' ERR

[ "${DEBUG:-0}" = "1" ] && set -x

ok()   { echo -e "  ${GREEN}✔${NC}  $1${NC}"; }
info() { echo -e "  ${CYAN}◆${NC}  ${WHITE}$1${NC}"; }
warn() { echo -e "  ${YELLOW}▲${NC}  ${YELLOW}$1${NC}"; }
err()  { echo -e "\n  ${RED}✖  ${BOLD}ОШИБКА:${NC} ${RED}$1${NC}\n"; exit 1; }
dim()  { echo -e "  ${GRAY}$1${NC}"; }
hint() { echo -e "  ${GRAY}╰╴${NC}${DIM}$1${NC}"; }

divider() {
  echo -e "${GRAY}  $(ui_repeat '▔' $((UI_INNER + 8)))${NC}"
}

section() {
  echo ""
  if [ "$UI_NARROW" = "1" ]; then
    echo -e "${BOLD}${MAGENTA}  ▣  ${WHITE}$1${NC}"
    echo -e "${GRAY}  $(ui_repeat '─' $((UI_INNER + 4)))${NC}"
  else
    echo -e "${BOLD}${MAGENTA}  ╔══ ${NC}${BOLD}${WHITE}$1 ${MAGENTA}${NC}"
    echo -e "${GRAY}  ╟$(ui_repeat '─' $((UI_INNER + 4)))${NC}"
  fi
}

subsection() {
  echo -e "  ${TEAL}▸${NC} ${BOLD}$1${NC}"
}

ask() {
  echo ""
  if [ "$UI_NARROW" = "1" ]; then
    echo -e "  ${ORANGE}▸ ${BOLD}$1${NC}"
    echo -e "  ${GRAY}$(ui_repeat '─' $((UI_INNER + 4)))${NC}"
  else
    echo -e "  ${ORANGE}┌─${BOLD} $1 ${NC}${ORANGE}$(ui_repeat '─' $((UI_INNER - 4)))┐${NC}"
  fi
}

prompt() {
  local __var=$1
  shift
  echo -en "  ${VIOLET}❯${NC} ${WHITE}$*${NC}: "
  read -r "$__var"
}

prompt_def() {
  local __var=$1
  local __def=$2
  shift 2
  echo -en "  ${VIOLET}❯${NC} ${WHITE}$*${NC} ${GRAY}[${CYAN}${__def}${GRAY}]${NC}: "
  read -r "$__var"
  if [ -z "${!__var}" ]; then
    printf -v "$__var" '%s' "$__def"
  fi
}

prompt_secret() {
  local __var=$1
  shift
  echo -en "  ${VIOLET}❯${NC} ${WHITE}$*${NC} ${GRAY}[скрыто]${NC}: "
  read -rs "$__var"
  echo ""
}

prompt_yn() {
  local __var=$1
  local __def=$2
  shift 2
  echo -en "  ${VIOLET}❯${NC} ${WHITE}$*${NC} ${GRAY}[${CYAN}${__def}${GRAY}]${NC}: "
  read -r "$__var"
  if [ -z "${!__var}" ]; then
    printf -v "$__var" '%s' "$__def"
  fi
}

choice_line() {
  echo -e "  ${GRAY}│${NC}  ${BOLD}${VIOLET}[$1]${NC} ${WHITE}$2${NC}  ${GRAY}— $3${NC}"
}

summary_row() {
  local key=$1 val=$2 color=${3:-$WHITE}
  val=$(ui_shorten "$val" "$((UI_INNER - 2))")
  if [ "$UI_NARROW" = "1" ]; then
    echo -e "  ${GRAY}│${NC} ${DIM}${key}${NC}"
    echo -e "  ${GRAY}│${NC}  ${color}${val}${NC}"
  else
    printf "  ${GRAY}│  ${DIM}%-14s${NC}  ${color}%s${NC}\n" "$key" "$val"
  fi
}

summary_panel_begin() {
  local title=$1
  local accent=${2:-$CYAN}
  local pad=$((UI_INNER - ${#title} - 6))
  [ "$pad" -lt 6 ] && pad=6
  echo ""
  if [ "$UI_NARROW" = "1" ]; then
    echo -e "  ${BOLD}${accent}▸ ${title}${NC}"
    echo -e "  ${GRAY}$(ui_repeat '─' $((UI_INNER + 4)))${NC}"
  else
    echo -e "${BOLD}${accent}  ╭── ${title} $(ui_repeat '─' "$pad")╮${NC}"
  fi
}

summary_panel_end() {
  local accent=${1:-$CYAN}
  if [ "$UI_NARROW" = "1" ]; then
    echo -e "  ${GRAY}$(ui_repeat '─' $((UI_INNER + 4)))${NC}"
  else
    echo -e "${BOLD}${accent}  ╰$(ui_repeat '─' $((UI_INNER + 6)))╯${NC}"
  fi
}

summary_box_begin() {
  summary_panel_begin "Итоговые настройки" "$CYAN"
}

summary_box_end() {
  summary_panel_end "$CYAN"
}

platform_chip() {
  local label=$1
  case "$PLATFORM" in
    wsl)    echo -e "${TEAL}${label}${NC} ${DIM}(Windows Subsystem for Linux)${NC}" ;;
    termux) echo -e "${ORANGE}${label}${NC} ${DIM}(Android)${NC}" ;;
    *)      echo -e "${GREEN}${label}${NC} ${DIM}(Linux server)${NC}" ;;
  esac
}

mode_chip() {
  if [ "$MODE" = "prod" ]; then
    echo -e "${GREEN}PRODUCTION${NC}"
  else
    echo -e "${ORANGE}LOCAL TEST${NC}"
  fi
}

print_banner() {
  ui_refresh_layout
  local bw=$((UI_INNER + 8))
  echo ""
  if [ "$UI_NARROW" = "1" ]; then
    echo -e "${ORANGE}  ╔$(ui_repeat '═' "$bw")╗${NC}"
    echo -e "${ORANGE}  ║${NC} ${BOLD}${WHITE}🦟 CICADA STUDIO${NC} ${DIM}v1.4${NC}           ${ORANGE}║${NC}"
    echo -e "${ORANGE}  ║${NC} ${GRAY}Установка · Настройка${NC}          ${ORANGE}║${NC}"
    echo -e "${ORANGE}  ╚$(ui_repeat '═' "$bw")╝${NC}"
  else
    echo -e "${ORANGE}  ╔$(ui_repeat '═' "$bw")╗${NC}"
    echo -e "${ORANGE}  ║$(ui_repeat ' ' "$bw")║${NC}"
    echo -e "${ORANGE}  ║${NC}  ${BOLD}${WHITE}   🦟  CICADA STUDIO${NC}  ${GRAY}·${NC}  ${DIM}Bootstrap v1.4${NC}       ${ORANGE}  ║${NC}"
    echo -e "${ORANGE}  ║${NC}  ${GRAY}   Установка · Настройка · Первый запуск${NC}         ${ORANGE}  ║${NC}"
    echo -e "${ORANGE}  ║$(ui_repeat ' ' "$bw")║${NC}"
    echo -e "${ORANGE}  ╚$(ui_repeat '═' "$bw")╝${NC}"
  fi
  echo ""
}

INSTALL_STEP=0
install_phase() {
  INSTALL_STEP=$((INSTALL_STEP + 1))
  local total="${INSTALL_TOTAL:-12}"
  echo ""
  echo -e "${BOLD}${VIOLET}  ┌─[${INSTALL_STEP}/${total}]${NC}  ${BOLD}${WHITE}$1${NC}"
  echo -e "${GRAY}  └$(ui_repeat '─' $((UI_INNER + 4)))${NC}"
}

# Устаревший core/validator ломает npm run build (scripts/core-guard.mjs)
prune_legacy_core_paths() {
  local root="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
  if [ -d "${root}/core/validator" ]; then
    info "Удаляем устаревший core/validator (требование core-guard)..."
    rm -rf "${root}/core/validator"
    ok "core/validator удалён"
  fi
}

nginx_ensure_dist_readable() {
  [ -d "$APP_DIR/dist" ] || return 0
  chmod 755 "$APP_DIR" 2>/dev/null || true
  find "$APP_DIR/dist" -type d -exec chmod 755 {} + 2>/dev/null || true
  find "$APP_DIR/dist" -type f -exec chmod 644 {} + 2>/dev/null || true
  if id www-data &>/dev/null; then
    if ! sudo -u www-data test -r "$APP_DIR/dist/index.html" 2>/dev/null; then
      $SUDO chmod -R a+rX "$APP_DIR/dist" 2>/dev/null || true
    fi
  fi
}

nginx_apply_prod_ssl_if_ready() {
  if [ "$MODE" != "prod" ] || [ "$PLATFORM" = "termux" ]; then
    return 0
  fi
  [ -n "${DOMAIN:-}" ] || return 0
  [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ] || return 0
  NGINX_CONF="${NGINX_CONF:-/etc/nginx/sites-available/cicada}"
  info "Nginx: полный PROD-конфиг с SSL (${DOMAIN})..."
  nginx_ensure_dist_readable
  $SUDO tee "$NGINX_CONF" > /dev/null << NGINX
server {
    listen 80;
    server_name ${DOMAIN};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name ${DOMAIN};

    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root ${APP_DIR}/dist;
    index index.html;

    location = /satana {
        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location = /satana.html { return 301 /satana; }

    location /api/firmware/build {
        client_max_body_size 100M;
        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 900s;
        proxy_connect_timeout 60s;
        proxy_send_timeout 900s;
    }

    location /firmware/ {
        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location ^~ /flash/ {
        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location ^~ /flash/jammer/ {
        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 120s;
    }

    location /run {
        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGINX
  $SUDO ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/cicada
  $SUDO rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
  if $SUDO nginx -t 2>"${CICADA_ERR_DIR}/cicada_nginx_err"; then
    svc_reload nginx
    ok "Nginx SSL-конфиг применён"
  else
    warn "Nginx: ошибка после SSL-конфига:"
    cat "${CICADA_ERR_DIR}/cicada_nginx_err" 2>/dev/null | tail -5 >&2 || true
  fi
}

# Согласовать .env с режимом prod/local (OAuth, NODE_ENV, venv, listen)
sync_runtime_env_file() {
  local envf="${APP_DIR}/.env"
  [ -f "$envf" ] || return 0

  local app_url="$APP_URL_VAL"
  local api_host="0.0.0.0"
  local listen_host="0.0.0.0"
  if [ "$PLATFORM" = "termux" ]; then
    api_host="127.0.0.1"
    listen_host="127.0.0.1"
  fi

  if [ "$MODE" = "prod" ] && [ -n "${DOMAIN:-}" ] && [ "$DOMAIN" != "localhost" ]; then
    app_url="https://${DOMAIN}"
  fi

  local google_cb="${GOOGLE_CALLBACK_URL:-}"
  if [ "$MODE" = "prod" ] && [ -n "$app_url" ]; then
    google_cb="${app_url}/api/auth/google/callback"
  fi

  local bot_venv_line=""
  if [ -d "${APP_DIR}/.venv-bot/bin" ]; then
    bot_venv_line="$(cd "${APP_DIR}/.venv-bot" && pwd)"
  elif [ -n "${BOT_PYTHON_VENV:-}" ]; then
    bot_venv_line="${BOT_PYTHON_VENV}"
  fi

  _env_patch() {
    local key=$1 val=$2
    local tmp="${envf}.patch.$$"
    grep -v "^${key}=" "$envf" >"$tmp" 2>/dev/null || cp "$envf" "$tmp"
    echo "${key}=${val}" >>"$tmp"
    mv -f "$tmp" "$envf"
  }

  _env_patch NODE_ENV "${NODE_ENV_VAL}"
  _env_patch APP_ENV "${APP_ENV_VAL}"
  _env_patch API_HOST "$api_host"
  _env_patch API_LISTEN_HOST "$listen_host"
  _env_patch APP_URL "$app_url"
  [ -n "$google_cb" ] && _env_patch GOOGLE_CALLBACK_URL "$google_cb"
  [ -n "$bot_venv_line" ] && _env_patch BOT_PYTHON_VENV "$bot_venv_line"
  chmod 600 "$envf"
  ok ".env синхронизирован (APP_URL, OAuth, NODE_ENV, API, venv)"
}

print_banner

# CRLF (редактор Windows) ломает строки с кириллицей и heredoc — конвертируем в LF
if grep -q $'\r' "${BASH_SOURCE[0]}" 2>/dev/null; then
  warn "setup.sh в формате CRLF — конвертируем в Unix (LF)..."
  sed -i 's/\r$//' "${BASH_SOURCE[0]}"
  exec bash "${BASH_SOURCE[0]}" "$@"
fi

# ═══════════════════════════════════════════════════════════════
# 0. ОПРЕДЕЛЕНИЕ ПЛАТФОРМЫ
# ═══════════════════════════════════════════════════════════════
detect_platform() {
  # webinstall в proot-distro Ubuntu: не Termux, несмотря на PLATFORM=termux в .env
  if [ -n "${CICADA_INSIDE_PROOT:-}" ]; then
    echo "vps"
    return
  fi
  if [ -n "${WEBINSTALL_PLATFORM:-}" ]; then
    echo "$WEBINSTALL_PLATFORM"
    return
  fi
  if [ -n "${TERMUX_VERSION:-}" ] || [ -d "/data/data/com.termux" ]; then
    echo "termux"
  elif [ -n "${WSL_DISTRO_NAME:-}" ] || [ -n "${WSLENV:-}" ]; then
    echo "wsl"
  elif grep -qiE "microsoft|wsl" /proc/sys/kernel/osrelease 2>/dev/null; then
    echo "wsl"
  elif grep -qiE "microsoft|wsl" /proc/version 2>/dev/null; then
    echo "wsl"
  elif [[ "${APP_DIR:-$(pwd)}" == /mnt/* ]]; then
    echo "wsl"
  else
    echo "vps"
  fi
}

termux_resolve_app_user() {
  local prefix="${PREFIX:-/data/data/com.termux/files/usr}"
  local u="${TERMUX_PKG_USER:-}"
  if [ -z "$u" ] || [ "$u" = "root" ]; then
    u=$(stat -c '%U' "$prefix" 2>/dev/null || true)
  fi
  if [ -z "$u" ] || [ "$u" = "root" ]; then
    u=$(ls -ld "$prefix" 2>/dev/null | awk '{print $3}')
  fi
  echo "$u"
}

PLATFORM=$(detect_platform)
ui_refresh_layout

case "$PLATFORM" in
  termux)
    SUDO=""
    HAS_SYSTEMCTL=false
    PREFIX="${PREFIX:-/data/data/com.termux/files/usr}"
    TERMUX_PKG_USER=$(termux_resolve_app_user)
    info "Платформа: $(platform_chip Termux)"
    if [ "$(id -u)" -eq 0 ]; then
      hint "Обнаружен root — скрипт перезапустится от пользователя ${TERMUX_PKG_USER:-termux}"
    fi
    ;;
  wsl)
    info "Платформа: $(platform_chip WSL)"
    SUDO="sudo"
    if systemctl list-units &>/dev/null 2>&1; then
      HAS_SYSTEMCTL=true
    else
      HAS_SYSTEMCTL=false
    fi
    ;;
  vps)
    info "Платформа: $(platform_chip VPS)"
    SUDO=""
    HAS_SYSTEMCTL=true
    ;;
esac

# Termux: логи установки в $HOME (общий /tmp часто недоступен для записи)
CICADA_ERR_DIR="${TMPDIR:-/tmp}"
[ "$PLATFORM" = "termux" ] && CICADA_ERR_DIR="$HOME"

# ─── Вспомогательные функции под платформу ─────────────────────

svc_enable() {
  local svc=$1
  if $HAS_SYSTEMCTL; then
    $SUDO systemctl enable "$svc" 2>/dev/null || true
    $SUDO systemctl start  "$svc" 2>/dev/null || true
  fi
}

svc_reload() {
  local svc=$1
  if $HAS_SYSTEMCTL; then
    $SUDO systemctl reload "$svc" 2>/dev/null || $SUDO systemctl restart "$svc" 2>/dev/null || true
  fi
}

svc_is_active() {
  local svc=$1
  if $HAS_SYSTEMCTL; then
    $SUDO systemctl is-active --quiet "$svc" 2>/dev/null
  else
    pgrep -x "$svc" &>/dev/null
  fi
}

termux_reexec_as_app_user() {
  [ "$PLATFORM" != "termux" ] && return 0
  [ "$(id -u)" -ne 0 ] && return 0

  local tuser
  tuser=$(termux_resolve_app_user)
  if [ -z "$tuser" ] || [ "$tuser" = "root" ]; then
    err "Termux: не найден пользователь приложения. Выйди из su (exit) и запусти: bash bootstrap.sh"
  fi

  local cwd script
  cwd="$(pwd)"
  case "$cwd" in
    /root/*)
      err "Termux: каталог ${cwd} недоступен пользователю ${tuser}.
Перенеси проект в домашнюю папку Termux:
  mkdir -p ~/cicada-studio && cp -a ${cwd}/. ~/cicada-studio/
  cd ~/cicada-studio && bash bootstrap.sh"
      ;;
  esac

  script="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
  if ! command -v su &>/dev/null; then
    err "Termux от root: нужен пакет su. В обычной сессии Termux (без su): pkg install su
Или выйди из root: exit — и снова bash bootstrap.sh"
  fi
  warn "Termux: pkg не работает от root — перезапуск от ${tuser}..."
  exec su -s /bin/bash "$tuser" -c \
    "export PATH=\"${PREFIX:-/data/data/com.termux/files/usr}/bin:\$PATH\"; cd $(printf '%q' "$cwd") && exec bash $(printf '%q' "$script")"
}

termux_pkg() {
  if [ "$(id -u)" -eq 0 ]; then
    echo "Error: Cannot run 'pkg' command as root" >&2
    return 1
  fi
  if ! command -v pkg &>/dev/null; then
    echo "Error: pkg not found — это Termux?" >&2
    return 1
  fi
  pkg "$@"
}

# Фиксированный ${CICADA_ERR_DIR}/cicada_pkg_err ломается в Termux (root создал файл — app user не пишет).
cicada_errlog_file() {
  local base d f
  for base in "${TMPDIR:-}" "${PREFIX:-}/tmp" "${HOME:-}" "$(pwd)"; do
    [ -z "$base" ] && continue
    d="${base%/}"
    mkdir -p "$d" 2>/dev/null || continue
    if f=$(mktemp "$d/cicada_pkg_err.XXXXXX" 2>/dev/null); then
      echo "$f"
      return 0
    fi
    f="$d/.cicada_pkg_err.$$"
    if : >"$f" 2>/dev/null; then
      echo "$f"
      return 0
    fi
  done
  echo "/dev/null"
}

termux_pkg_update() {
  local errlog
  errlog=$(cicada_errlog_file)
  if ! termux_pkg update -y 2>"$errlog"; then
    warn "pkg update не удался: $(tail -3 "$errlog" 2>/dev/null)"
    rm -f "$errlog"
    return 1
  fi
  : >"$errlog"
  if ! termux_pkg upgrade -y 2>"$errlog"; then
    warn "pkg upgrade не удался: $(tail -3 "$errlog" 2>/dev/null)"
    rm -f "$errlog"
    return 1
  fi
  rm -f "$errlog"
}

pkg_install() {
  if [ "$PLATFORM" = "termux" ]; then
    termux_pkg install -y "$@" || return 1
  else
    $SUDO apt-get install -y -qq "$@"
  fi
}

# Termux: весь bootstrap только от пользователя приложения (не root)
termux_reexec_as_app_user

# ═══════════════════════════════════════════════════════════════
# 0b. ROOT CHECK (только для VPS)
# ═══════════════════════════════════════════════════════════════
if [ "$PLATFORM" = "vps" ] && [ "${EUID:-$(id -u)}" -ne 0 ]; then
  err "Запусти скрипт от root: sudo bash bootstrap.sh"
fi

# ─── Web-установщик (python3 webinstall.py) ─────────────────────
WEBINSTALL_ENV=""
while [ $# -gt 0 ]; do
  case "$1" in
    --webinstall)
      WEBINSTALL_ENV="${2:-}"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

apply_webinstall_preset() {
  [ -n "$WEBINSTALL_ENV" ] || return 1
  [ -f "$WEBINSTALL_ENV" ] || err "Webinstall: файл не найден: $WEBINSTALL_ENV"
  set -a
  # shellcheck disable=SC1090
  source "$WEBINSTALL_ENV"
  set +a
  if [ -n "${CICADA_INSIDE_PROOT:-}" ]; then
    PLATFORM=vps
  fi
  CONFIRM="${CONFIRM:-y}"
  USE_ADMIN_KEY="${USE_ADMIN_KEY:-y}"
  USE_JWT_SECRET="${USE_JWT_SECRET:-y}"
  APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
  if [ "${MODE_CHOICE:-}" = "1" ] && [ "$PLATFORM" != "termux" ]; then
    MODE="prod"
  else
    MODE="${MODE:-local}"
  fi
  if [ "$MODE" = "prod" ]; then
    PREVIEW_APP_URL="https://${DOMAIN}"
    GOOGLE_CALLBACK_URL="${PREVIEW_APP_URL}/api/auth/google/callback"
  else
    DOMAIN="${DOMAIN:-localhost}"
    PREVIEW_APP_URL="${PREVIEW_APP_URL:-https://localhost}"
  fi
  INSTALL_ESPHOME="${INSTALL_ESPHOME:-0}"
  if [ "$PLATFORM" = "termux" ]; then
    MODE="local"
    DOMAIN="${DOMAIN:-localhost}"
    ADMIN_EMAIL="${ADMIN_EMAIL:-admin@local}"
    ADMIN_PASSWORD=""
    ADMIN_NAME="${ADMIN_NAME:-Admin}"
    INSTALL_ESPHOME=0
    DISABLE_FIRMWARE_RUNTIME=1
  elif [ "$MODE" = "local" ]; then
    ADMIN_EMAIL="${ADMIN_EMAIL:-denisbednakov@gmail.com}"
    ADMIN_PASSWORD="${ADMIN_PASSWORD:-cicada3301}"
    ADMIN_NAME="${ADMIN_NAME:-Admin}"
    AUTH_BYPASS_VAL="1"
  fi
  return 0
}

if apply_webinstall_preset; then
  info "Параметры из webinstall: $(basename "$WEBINSTALL_ENV")"
  section "Проверка параметров (webinstall)"
  summary_box_begin
  summary_row "Платформа" "$PLATFORM" "$TEAL"
  summary_row "Режим" "$MODE" "$ORANGE"
  summary_row "Домен" "$DOMAIN" "$CYAN"
  summary_row "Папка" "$APP_DIR" "$WHITE"
  summary_row "Порт" "$API_PORT" "$CYAN"
  summary_row "ADMIN_EMAIL" "${ADMIN_EMAIL:-—}" "$ORANGE"
  if [ "$PLATFORM" = "termux" ]; then
    summary_row "Вход" "не требуется (AUTH_BYPASS)" "$GREEN"
  fi
  summary_box_end
  ok "Запуск установки (без интерактивного опроса)"
else

# ═══════════════════════════════════════════════════════════════
# 1. РЕЖИМ: PROD или LOCAL
# ═══════════════════════════════════════════════════════════════
ask "Режим установки"
choice_line 1 "PROD"  "сервер с доменом и SSL (Let's Encrypt)"
choice_line 2 "LOCAL" "локальный тест, self-signed SSL"

if [ "$PLATFORM" = "termux" ]; then
  warn "На Termux PROD недоступен — выбран LOCAL"
  MODE_CHOICE=2
else
  prompt_def MODE_CHOICE 1 "Выбери режим [1/2]"
fi

if [ "$MODE_CHOICE" = "1" ] && [ "$PLATFORM" != "termux" ]; then
  MODE="prod"
  info "Режим: $(mode_chip)"
else
  MODE="local"
  info "Режим: $(mode_chip)"
fi

# ═══════════════════════════════════════════════════════════════
# 2. СБОР ПАРАМЕТРОВ
# ═══════════════════════════════════════════════════════════════
section "Основные настройки"

if [ "$MODE" = "prod" ]; then
  prompt DOMAIN "Домен (например: example.com)"
  [ -z "$DOMAIN" ] && err "Домен обязателен"
  prompt LE_EMAIL "Email для Let's Encrypt"
  [ -z "$LE_EMAIL" ] && err "Email обязателен"
else
  DOMAIN="localhost"
  LE_EMAIL=""
  dim "Домен: localhost (LOCAL)"
fi

if [ "$MODE" = "prod" ]; then
  PREVIEW_APP_URL="https://${DOMAIN}"
else
  PREVIEW_APP_URL="https://localhost"
fi

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
hint "Папка установки → ${CYAN}${APP_DIR}${NC}"

prompt_def API_PORT 3001 "Порт Node.js сервера"

section "PostgreSQL"
prompt_def DB_NAME cicada "Имя БД"
prompt_def DB_USER cicada_user "Пользователь БД"

while true; do
  prompt_secret DB_PASSWORD "Пароль БД (мин. 8 символов)"
  [ ${#DB_PASSWORD} -ge 8 ] && break
  warn "Слишком короткий пароль, минимум 8 символов"
done

section "Безопасность"
_gen_hex32() {
  if command -v openssl &>/dev/null; then
    openssl rand -hex 32
  elif command -v python3 &>/dev/null; then
    python3 -c "import secrets; print(secrets.token_hex(32))"
  elif command -v od &>/dev/null; then
    od -A n -t x1 -N 32 /dev/urandom | tr -d ' \n'
  else
    err "Нет инструмента для генерации случайного ключа (нужен openssl, python3 или od)"
  fi
}

if command -v openssl &>/dev/null; then
  ADMIN_KEY=$(openssl rand -hex 32)
else
  ADMIN_KEY=$(_gen_hex32)
fi
hint "ADMIN_KEY (авто): ${CYAN}${ADMIN_KEY}${NC}"
prompt_yn USE_ADMIN_KEY y "Использовать этот ADMIN_KEY"
if [ "${USE_ADMIN_KEY,,}" = "n" ]; then
  while true; do
    prompt_secret ADMIN_KEY "Введи свой ADMIN_KEY (мин. 12 символов)"
    [ ${#ADMIN_KEY} -ge 12 ] && break
    warn "ADMIN_KEY должен быть не короче 12 символов"
  done
fi

JWT_SECRET=""
prompt_yn USE_JWT_SECRET y "Автоматически сгенерировать JWT_SECRET"
if [ "${USE_JWT_SECRET,,}" = "n" ]; then
  while true; do
    prompt_secret JWT_SECRET "JWT_SECRET (PROD ≥ 32 символов)"
    if [ "$MODE" = "prod" ]; then
      [ ${#JWT_SECRET} -ge 32 ] && break
      warn "Для PROD минимум 32 символа"
    else
      [ ${#JWT_SECRET} -ge 8 ] && break
      warn "Минимум 8 символов"
    fi
  done
fi

ADMIN_PASSWORD=""
ADMIN_NAME="Admin"
section "Учётная запись (вход в Studio)"
if [ "$MODE" = "local" ]; then
  if [ "$PLATFORM" = "termux" ]; then
    hint "AUTH_BYPASS=1: вход без пароля (mock-пользователь dev-bypass-user)"
    prompt_def ADMIN_EMAIL "admin@local" "Email для UI (VITE_ADMIN_EMAIL)"
    ADMIN_PASSWORD=""
  else
  prompt_def ADMIN_EMAIL "denisbednakov@gmail.com" "Email администратора"
  prompt_def ADMIN_NAME "Admin" "Имя в профиле"
  ADMIN_PASSWORD="${ADMIN_PASSWORD:-cicada3301}"
  hint "Пароль по умолчанию: ${ADMIN_PASSWORD} (Enter — оставить)"
  while true; do
    prompt_secret ADMIN_PASSWORD_IN "Пароль для входа"
    if [ -z "$ADMIN_PASSWORD_IN" ]; then
      ADMIN_PASSWORD_IN="$ADMIN_PASSWORD"
    fi
    ADMIN_PASSWORD="$ADMIN_PASSWORD_IN"
    [ ${#ADMIN_PASSWORD} -ge 8 ] || { warn "Минимум 8 символов"; continue; }
    prompt_secret ADMIN_PASSWORD2 "Повторите пароль (Enter = тот же)"
    if [ -z "$ADMIN_PASSWORD2" ]; then
      ADMIN_PASSWORD2="$ADMIN_PASSWORD"
    fi
    [ "$ADMIN_PASSWORD" = "$ADMIN_PASSWORD2" ] && break
    warn "Пароли не совпадают"
  done
  fi
else
  prompt_def ADMIN_EMAIL "denisbednakov@gmail.com" "Email администратора"
fi

section "Telegram"
hint "Enter — пропустить необязательные поля"
prompt TG_BOT_TOKEN "TG_BOT_TOKEN"
prompt TG_BOT_NAME "Имя бота без @"

RESEND_API_KEY=""
EMAIL_FROM="noreply@${DOMAIN}"
CRYPTOBOT_TOKEN=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_CALLBACK_URL="${PREVIEW_APP_URL}/api/auth/google/callback"
GROQ_TOKEN=""
GROQ_TOKEN_2=""
GROQ_TOKEN_3=""
OLLAMA_URL="http://127.0.0.1:11434"
OLLAMA_MODEL="qwen2.5:3b"

if [ "$MODE" = "prod" ]; then
  section "Email (Resend)"
  prompt RESEND_API_KEY "RESEND_API_KEY"
  prompt_def EMAIL_FROM "noreply@${DOMAIN}" "EMAIL_FROM"

  section "CryptoBot"
  prompt CRYPTOBOT_TOKEN "CRYPTOBOT_TOKEN"

  section "Google OAuth"
  prompt GOOGLE_CLIENT_ID "GOOGLE_CLIENT_ID"
  prompt_secret GOOGLE_CLIENT_SECRET "GOOGLE_CLIENT_SECRET"
  prompt_def GOOGLE_CALLBACK_URL "${PREVIEW_APP_URL}/api/auth/google/callback" "GOOGLE_CALLBACK_URL"

  section "Groq API (AI)"
  prompt_secret GROQ_TOKEN "GROQ_TOKEN"
  prompt_secret GROQ_TOKEN_2 "GROQ_TOKEN_2"
  prompt_secret GROQ_TOKEN_3 "GROQ_TOKEN_3"

  section "Ollama (локальный AI)"
  prompt_def OLLAMA_URL "http://127.0.0.1:11434" "OLLAMA_URL"
  prompt_def OLLAMA_MODEL "qwen2.5:3b" "OLLAMA_MODEL"
else
  if [ "$PLATFORM" = "termux" ]; then
    hint "Termux (LOCAL): Resend, CryptoBot, OAuth, Groq и Ollama — пропущены, допиши в .env при необходимости"
  else
    hint "LOCAL: Resend, CryptoBot, OAuth и Groq пропущены — при необходимости добавь в .env"
  fi
fi

if [ "$MODE" = "prod" ] || [ "$PLATFORM" != "termux" ]; then
  section "Доп. защита админки (TOTP)"
  prompt_secret ADMIN_TOTP_SECRET "ADMIN_TOTP_SECRET (Enter — пропустить)"
else
  ADMIN_TOTP_SECRET=""
  hint "Termux: TOTP для админки пропущен"
fi

INSTALL_ESPHOME=0
ESPHOME_PIN="${ESPHOME_PIN:-}"
DISABLE_FIRMWARE_RUNTIME="${DISABLE_FIRMWARE_RUNTIME:-0}"
if [ "$PLATFORM" = "termux" ]; then
  INSTALL_ESPHOME=0
  DISABLE_FIRMWARE_RUNTIME=1
  hint "Termux: ESPHome и сборка прошивок отключены (DISABLE_FIRMWARE_RUNTIME=1)"
else
  section "ESPHome (/esphome, сборка прошивок)"
  prompt_yn INSTALL_ESPHOME_ANS y "Установить ESPHome в .venv-esphome"
  if [ "${INSTALL_ESPHOME_ANS,,}" != "n" ]; then
    INSTALL_ESPHOME=1
    prompt ESPHOME_PIN_INPUT "Версия esphome на PyPI (Enter = последняя)"
    ESPHOME_PIN_INPUT=$(echo "$ESPHOME_PIN_INPUT" | tr -d '[:space:]')
    if [ -n "$ESPHOME_PIN_INPUT" ]; then
      ESPHOME_PIN="$ESPHOME_PIN_INPUT"
    fi
  fi
fi

# ═══════════════════════════════════════════════════════════════
# 3. ПОДТВЕРЖДЕНИЕ
# ═══════════════════════════════════════════════════════════════
summary_box_begin
summary_row "Платформа" "$PLATFORM" "$TEAL"
if [ "$MODE" = "prod" ]; then
  summary_row "Режим" "$MODE" "$GREEN"
else
  summary_row "Режим" "$MODE" "$ORANGE"
fi
summary_row "Домен" "$DOMAIN" "$CYAN"
summary_row "Папка" "$APP_DIR" "$WHITE"
summary_row "Порт" "$API_PORT" "$CYAN"
summary_row "БД" "${DB_NAME} @ localhost" "$WHITE"
summary_row "DB_USER" "$DB_USER" "$WHITE"
summary_row "ADMIN_EMAIL" "$ADMIN_EMAIL" "$ORANGE"
if [ "$PLATFORM" = "termux" ]; then
  summary_row "Вход" "не требуется (AUTH_BYPASS)" "$GREEN"
elif [ "$MODE" = "local" ] && [ -n "$ADMIN_PASSWORD" ]; then
  summary_row "Пароль входа" "задан (${#ADMIN_PASSWORD} симв.)" "$GREEN"
fi
if [ "$INSTALL_ESPHOME" = "1" ]; then
  summary_row "ESPHome" "да (.venv-esphome${ESPHOME_PIN:+, ${ESPHOME_PIN}})" "$GREEN"
else
  summary_row "ESPHome" "нет" "$DIM"
fi
summary_box_end
echo ""
prompt_yn CONFIRM y "Всё верно? Начать установку"
[ "${CONFIRM,,}" = "n" ] && err "Установка отменена"

fi
# конец интерактивного опроса (webinstall пропускает блок выше)

# ═══════════════════════════════════════════════════════════════
# 4. СИСТЕМА И ЗАВИСИМОСТИ
# ═══════════════════════════════════════════════════════════════
INSTALL_TOTAL=12
section "Установка компонентов"
install_phase "Системные пакеты"
info "Обновляем пакеты..."
if [ "$PLATFORM" = "termux" ]; then
  if ! termux_pkg_update; then
    err "Не удалось обновить пакеты Termux.
    Попробуй: pkg install su && pkg update -y
    Или запусти не от root: exit && bash bootstrap.sh"
  fi
  ok "Пакеты Termux обновлены"
else
  apt_err=$(cicada_errlog_file)
  if ! $SUDO apt-get update -qq 2>"$apt_err"; then
    err "apt-get update не удался:
    $(tail -5 "$apt_err" 2>/dev/null)
  Проверь подключение к интернету и /etc/apt/sources.list"
  fi
  $SUDO apt-get upgrade -y -qq 2>/dev/null || warn "apt-get upgrade завершился с предупреждениями (некритично)"
  rm -f "$apt_err"
  ok "Пакеты обновлены"
fi

# ─── Базовые утилиты ───────────────────────────────────────────
if [ "$PLATFORM" = "termux" ]; then
  if ! pkg_install curl git openssl-tool; then
    err "Не удалось установить curl, git, openssl-tool (pkg install)"
  fi
else
  $SUDO apt-get install -y -qq curl git openssl ca-certificates
  [ "$PLATFORM" = "vps" ] && $SUDO apt-get install -y -qq ufw
  # DSL sandbox (bwrap) + зависимости для ESPHome/PlatformIO
  $SUDO apt-get install -y -qq bubblewrap python3-venv python3-dev \
    build-essential pkg-config libffi-dev git 2>/dev/null \
    || $SUDO apt-get install -y -qq bubblewrap python3-venv git build-essential
fi
ok "Базовые утилиты установлены"

install_phase "Python и aiogram (bot runtime)"

# Termux: нативная установка (без proot-distro / Ubuntu) — setup-termux-safe-final
if [ "$PLATFORM" = "termux" ]; then
  warn "Termux: пропускаем Ubuntu в proot-distro — работаем нативно"
  info "Используем системный Python из Termux..."
fi

if ! command -v python3 &>/dev/null; then
  info "Устанавливаем Python 3..."
  if [ "$PLATFORM" = "termux" ]; then
    pkg_install python || err "Не удалось установить python (pkg install python)"
  else
    $SUDO apt-get install -y -qq python3 python3-pip
  fi
  ok "Python $(python3 --version) установлен"
else
  ok "Python $(python3 --version) уже установлен"
fi

# ─── aiogram 3 (production bot target) ─────────────────────────────
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
BOT_VENV="${APP_DIR}/.venv-bot"

install_bot_python_runtime() {
  # VPS/WSL: venv обязателен (preview worker, bot runner)
  if [ ! -d "$BOT_VENV" ] || [ ! -x "${BOT_VENV}/bin/python3" ]; then
    rm -rf "$BOT_VENV" 2>/dev/null || true
    if python3 -m venv "$BOT_VENV" 2>/dev/null; then
      info "venv создан: $BOT_VENV"
    elif [ "$PLATFORM" = "termux" ]; then
      warn "venv не удалось создать — буду использовать глобальный pip"
      BOT_VENV=""
    else
      err "Не удалось создать ${BOT_VENV}. Установи: apt install python3-venv python3-pip"
    fi
  fi

  if [ -n "$BOT_VENV" ] && [ -d "$BOT_VENV" ]; then
    # shellcheck disable=SC1091
    . "$BOT_VENV/bin/activate" 2>/dev/null || . "$BOT_VENV/Scripts/activate" 2>/dev/null || true
  fi

  if [ "$PLATFORM" = "termux" ]; then
    python3 -m ensurepip --upgrade 2>/dev/null || true
    python3 -m pip install --upgrade pip wheel setuptools 2>/dev/null || true
    export PATH="${PREFIX:-/data/data/com.termux/files/usr}/bin:${PATH}"
    export CARGO_HOME="${HOME}/.cargo"
    export RUSTUP_HOME="${HOME}/.rustup"
    info "Termux: пакеты для сборки Python-зависимостей..."
    pkg_install binutils libffi openssl 2>/dev/null \
      || pkg_install binutils 2>/dev/null || true
    command -v cargo &>/dev/null || pkg_install rust 2>/dev/null || true
    command -v clang &>/dev/null || pkg_install clang 2>/dev/null || true
  fi

  _pip() {
    if [ "$PLATFORM" = "termux" ]; then
      python3 -m pip "$@"
    else
      pip "$@"
    fi
  }

  _bot_py() {
    if [ -n "$BOT_VENV" ] && [ -x "${BOT_VENV}/bin/python3" ]; then
      "${BOT_VENV}/bin/python3" "$@"
    else
      python3 "$@"
    fi
  }

  if [ -f "${APP_DIR}/requirements-bot.txt" ]; then
    _bot_pip_log=$(cicada_errlog_file)
    if _pip install --prefer-binary -r "${APP_DIR}/requirements-bot.txt" 2>"$_bot_pip_log"; then
      ok "aiogram установлен"
    else
      warn "pip: requirements-bot.txt — см. лог ниже"
      tail -8 "$_bot_pip_log" 2>/dev/null | sed 's/^/    /' >&2 || true
      rm -f "$_bot_pip_log"
      if _pip install --prefer-binary aiogram 'aiohttp>=3.9,<4' 2>"$_bot_pip_log"; then
        ok "aiogram (минимальный набор) установлен"
      else
        warn "Не удалось установить aiogram — проверь сеть: pkg install rust binutils clang"
        tail -6 "$_bot_pip_log" 2>/dev/null | sed 's/^/    /' >&2 || true
      fi
      rm -f "$_bot_pip_log"
    fi
  else
    warn "requirements-bot.txt не найден"
  fi

  if _bot_py -c "import aiogram" 2>/dev/null; then
    ok "aiogram: проверка import OK"
  elif [ "$PLATFORM" = "termux" ]; then
    warn "aiogram не импортируется — Telegram-бот может не работать (остальная установка продолжится)"
  elif [ -n "$BOT_VENV" ] && [ -d "$BOT_VENV" ]; then
    warn "aiogram не импортируется в ${BOT_VENV}"
  fi
}

install_bot_python_runtime

PYTHON=$(command -v python3 || echo /usr/bin/python3)
if [ -n "$BOT_VENV" ] && [ -d "$BOT_VENV" ]; then
  BOT_PYTHON_VENV="$(cd "$BOT_VENV" && pwd)"
else
  BOT_PYTHON_VENV="${APP_DIR}/.venv-bot"
fi

install_phase "Node.js, PM2, PostgreSQL, Nginx"
if [ "$PLATFORM" = "termux" ]; then
  _termux_pkgs=()
  command -v node &>/dev/null || _termux_pkgs+=(nodejs)
  command -v psql &>/dev/null || _termux_pkgs+=(postgresql)
  if [ "${#_termux_pkgs[@]}" -gt 0 ]; then
    info "Termux: pkg install ${_termux_pkgs[*]} (может занять несколько минут)..."
    pkg_install "${_termux_pkgs[@]}" || err "Не удалось: pkg install ${_termux_pkgs[*]}"
  fi
fi
if ! command -v node &>/dev/null; then
  info "Устанавливаем Node.js 20..."
  if [ "$PLATFORM" = "termux" ]; then
    pkg_install nodejs || err "Не удалось установить nodejs (pkg install nodejs)"
  else
    curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO bash - &>/dev/null
    $SUDO apt-get install -y -qq nodejs
  fi
  ok "Node.js $(node -v) установлен"
else
  ok "Node.js $(node -v) уже установлен"
fi

# ─── PM2 ───────────────────────────────────────────────────────
if ! command -v pm2 &>/dev/null; then
  info "Устанавливаем PM2..."
  _pm2_log=$(cicada_errlog_file)
  set +e
  npm install -g pm2 2>"$_pm2_log"
  _pm2_rc=$?
  set -e
  if [ "$_pm2_rc" -eq 0 ] || command -v pm2 &>/dev/null; then
    ok "PM2 установлен"
  else
    warn "PM2: npm install -g не удался"
    tail -5 "$_pm2_log" 2>/dev/null | sed 's/^/    /' >&2 || true
    hint "Вручную: npm install -g pm2  (или npx pm2)"
  fi
  rm -f "$_pm2_log"
else
  ok "PM2 уже установлен"
fi

# ─── PostgreSQL ────────────────────────────────────────────────
if ! command -v psql &>/dev/null; then
  info "Устанавливаем PostgreSQL..."
  if [ "$PLATFORM" = "termux" ]; then
    pkg_install postgresql || err "Не удалось установить postgresql (pkg install postgresql)"
    if [ ! -d "$PREFIX/var/lib/postgresql" ]; then
      mkdir -p "$PREFIX/var/lib/postgresql" || warn "Не удалось создать каталог PostgreSQL"
    fi
    if initdb -D "$PREFIX/var/lib/postgresql" &>/dev/null; then
      info "PostgreSQL: initdb выполнен"
    else
      warn "initdb не завершился — кластер может быть уже инициализирован"
    fi
  else
    if command -v debconf-set-selections &>/dev/null; then
      echo "postgresql-common postgresql-common/default_cluster select main" \
        | debconf-set-selections 2>/dev/null || true
    fi
    $SUDO apt-get update -qq
    $SUDO apt-get install -y -qq postgresql postgresql-contrib
  fi
  ok "PostgreSQL установлен"
else
  ok "PostgreSQL уже установлен"
fi

# Запуск PostgreSQL
if [ "$PLATFORM" = "termux" ]; then
  if pg_ctl -D "$PREFIX/var/lib/postgresql" -l "$PREFIX/var/lib/postgresql/pg.log" start 2>/dev/null; then
    ok "PostgreSQL запущен"
  else
    warn "PostgreSQL не запустился — возможно уже работает (pgrep postgres)"
  fi
elif $HAS_SYSTEMCTL; then
  $SUDO systemctl start postgresql &>/dev/null || warn "systemctl start postgresql — сервис может быть уже запущен"
  $SUDO systemctl enable postgresql &>/dev/null || true
else
  warn "systemctl недоступен — запусти PostgreSQL вручную (service postgresql start)"
fi

# ─── Nginx (только VPS и WSL) ──────────────────────────────────
if [ "$PLATFORM" != "termux" ]; then
  if ! command -v nginx &>/dev/null; then
    info "Устанавливаем Nginx..."
    $SUDO apt-get install -y -qq nginx
    svc_enable nginx
    ok "Nginx установлен"
  else
    ok "Nginx уже установлен"
  fi
else
  warn "Nginx пропущен — не поддерживается на Termux"
fi

# ─── ESPHome (venv в каталоге проекта) ─────────────────────────
ESPHOME_BIN_PATH=""
PIO_BIN_PATH=""
if [ "$INSTALL_ESPHOME" = "1" ]; then
  install_phase "ESPHome (.venv-esphome)"
  info "Устанавливаем ESPHome (может занять несколько минут)..."
  hint "${APP_DIR}/.venv-esphome"
  if ! python3 -m venv --help &>/dev/null; then
    if [ "$PLATFORM" != "termux" ]; then
      $SUDO apt-get install -y -qq python3-venv
    fi
  fi
  python3 -m venv "${APP_DIR}/.venv-esphome"
  # shellcheck source=/dev/null
  "${APP_DIR}/.venv-esphome/bin/pip" install --upgrade pip wheel setuptools -q
  if [ -n "${ESPHOME_PIN:-}" ]; then
  "${APP_DIR}/.venv-esphome/bin/pip" install -q "esphome==${ESPHOME_PIN}"
  else
    "${APP_DIR}/.venv-esphome/bin/pip" install -q esphome
  fi
  chmod +x "${APP_DIR}/.venv-esphome/bin/"* 2>/dev/null || true
  ESPHOME_BIN_PATH="${APP_DIR}/.venv-esphome/bin/esphome"
  if [ ! -f "$ESPHOME_BIN_PATH" ]; then
    warn "ESPHome CLI не найден в venv — ESPHOME_BIN не будет записан в .env"
    ESPHOME_BIN_PATH=""
  fi
  if [ -x "${APP_DIR}/.venv-esphome/bin/pio" ]; then
    PIO_BIN_PATH="${APP_DIR}/.venv-esphome/bin/pio"
  elif [ -x "${APP_DIR}/.venv-esphome/bin/platformio" ]; then
    PIO_BIN_PATH="${APP_DIR}/.venv-esphome/bin/platformio"
  elif [ -f "${APP_DIR}/.venv-esphome/bin/pio" ]; then
    PIO_BIN_PATH="${APP_DIR}/.venv-esphome/bin/pio"
    chmod +x "$PIO_BIN_PATH" 2>/dev/null || true
  fi
  _esphome_ver=""
  if [ -n "$ESPHOME_BIN_PATH" ] && [ -x "$ESPHOME_BIN_PATH" ]; then
    _esphome_ver=$("$ESPHOME_BIN_PATH" version 2>/dev/null | head -1)
  elif [ -x "${APP_DIR}/.venv-esphome/bin/python" ]; then
    _esphome_ver=$("${APP_DIR}/.venv-esphome/bin/python" -m esphome version 2>/dev/null | head -1)
  fi
  ok "ESPHome: ${_esphome_ver:-установлен}"
  if [ -n "$PIO_BIN_PATH" ]; then
    _pio_ver=$("$PIO_BIN_PATH" --version 2>/dev/null | head -1 || echo "$PIO_BIN_PATH")
    ok "PlatformIO: ${_pio_ver}"
  else
    warn "pio не найден в venv — при сборке ESPHome подтянет PlatformIO при первом compile"
  fi
fi

if command -v bwrap &>/dev/null; then
  ok "bubblewrap DSL sandbox: $(command -v bwrap)"
elif [ "$PLATFORM" != "termux" ]; then
  warn "bwrap не найден — DSL sandbox без изоляции, см. DSL_SANDBOX_MODE в .env"
fi

# ═══════════════════════════════════════════════════════════════
# 5. POSTGRESQL — СОЗДАНИЕ БД И ПОЛЬЗОВАТЕЛЯ
# ═══════════════════════════════════════════════════════════════
install_phase "База данных PostgreSQL"
info "Создаём БД и пользователя..."

pgsql_super() {
  if [ "$PLATFORM" = "termux" ]; then
    psql -U "$(whoami)" -d "$(whoami)" "$@"
  else
    sudo -u postgres psql "$@"
  fi
}

if [ "$PLATFORM" = "termux" ]; then
  createdb "$(whoami)" 2>/dev/null || true
fi

if ! pgsql_super << SQL 2>"${CICADA_ERR_DIR}/cicada_pg_err"
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';
  ELSE
    ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec

GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL
then
  _pg_err=$(cat ${CICADA_ERR_DIR}/cicada_pg_err 2>/dev/null || echo "нет деталей")
  err "Ошибка настройки PostgreSQL:
    ${_pg_err}
  Убедись что PostgreSQL запущен и пользователь postgres существует."
fi

pgsql_super -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};" 2>${CICADA_ERR_DIR}/cicada_pg_err \
  || warn "GRANT на schema public не удался: $(cat ${CICADA_ERR_DIR}/cicada_pg_err 2>/dev/null)"
ok "БД '${DB_NAME}' и пользователь '${DB_USER}' готовы"

# ═══════════════════════════════════════════════════════════════
# 6. ПРИЛОЖЕНИЕ — ПАПКА И ЗАВИСИМОСТИ
# ═══════════════════════════════════════════════════════════════
install_phase "Приложение и npm"
info "Project setup"
hint "$APP_DIR"
mkdir -p "$APP_DIR"
cd "$APP_DIR" || err "Cannot cd to APP_DIR: $APP_DIR"

if [ -f "package.json" ]; then
  info "Cleanup: node_modules, package-lock.json, dist"
  rm -rf node_modules package-lock.json dist
  ok "Cleaned node_modules, package-lock.json, dist"
  info "npm install --legacy-peer-deps (включая tsx для PM2)"
  # NODE_ENV=production в окружении иначе npm не ставит devDependencies — tsx нужен в runtime
  if ! env NPM_CONFIG_PRODUCTION=false NODE_ENV=development npm install --legacy-peer-deps \
    2>${CICADA_ERR_DIR}/cicada_npm_err; then
    _npm_err=$(tail -8 ${CICADA_ERR_DIR}/cicada_npm_err 2>/dev/null || echo "no log")
    err "npm install failed. Check package.json and registry. Log: ${_npm_err}"
  fi
  info "npm install passport (OAuth)"
  if ! npm install passport passport-google-oauth20 express-session 2>${CICADA_ERR_DIR}/cicada_npm_err; then
    _npm_err=$(tail -8 ${CICADA_ERR_DIR}/cicada_npm_err 2>/dev/null || echo "no log")
    err "npm install (passport) failed. Log: ${_npm_err}"
  fi
  ok "npm install OK"
  if [ ! -d "$APP_DIR/node_modules/tsx" ]; then
    info "Доустанавливаем tsx (runtime для server.mjs)..."
    npm install tsx@^4.22.3 --legacy-peer-deps --no-save 2>/dev/null \
      || npm install tsx --legacy-peer-deps 2>/dev/null \
      || err "Не найден пакет tsx — PM2 не сможет запустить server.mjs"
  fi
  chmod -R 755 "$APP_DIR" 2>/dev/null || true
else
  warn "package.json not found in $APP_DIR"
fi

mkdir -p "$APP_DIR/uploads/media" "$APP_DIR/bots" "$APP_DIR/data/firmware-cache" \
  2>/dev/null || true
if [ "$PLATFORM" != "termux" ]; then
  mkdir -p "$APP_DIR/public/firmware" "$APP_DIR/public/flash/jammer" "$APP_DIR/.cache/platformio" \
    /tmp/esphome-jobs 2>/dev/null || true
fi
ok "Рабочие каталоги (bots/, uploads/, firmware/) созданы"

# Jammer / ESPHome артефакты — только VPS/WSL (на Termux прошивки отключены)
if [ "$PLATFORM" != "termux" ]; then
  JAMMER_FIRMWARE_BIN="${APP_DIR}/public/firmware/esp8266_deauther.bin"
  mkdir -p "$(dirname "$JAMMER_FIRMWARE_BIN")"

  JAMMER_SRC=""
  for _jammer_candidate in \
    "$JAMMER_FIRMWARE_BIN" \
    "$APP_DIR/esp8266_deauther.bin" \
    "$APP_DIR/public/flash/jammer/esp8266_deauther.bin"; do
    if [ -f "$_jammer_candidate" ]; then
      JAMMER_SRC="$_jammer_candidate"
      break
    fi
  done

  if [ -f "$APP_DIR/esp8266_deauther.bin" ] && [ ! -f "$JAMMER_FIRMWARE_BIN" ]; then
    cp -f "$APP_DIR/esp8266_deauther.bin" "$JAMMER_FIRMWARE_BIN"
    JAMMER_SRC="$JAMMER_FIRMWARE_BIN"
    ok "Прошивка скопирована в ${JAMMER_FIRMWARE_BIN}"
  elif [ -f "$APP_DIR/public/flash/jammer/esp8266_deauther.bin" ] && [ ! -f "$JAMMER_FIRMWARE_BIN" ]; then
    cp -f "$APP_DIR/public/flash/jammer/esp8266_deauther.bin" "$JAMMER_FIRMWARE_BIN"
    JAMMER_SRC="$JAMMER_FIRMWARE_BIN"
    ok "Прошивка скопирована в ${JAMMER_FIRMWARE_BIN}"
  fi

  if [ -f "$JAMMER_SRC" ]; then
    if cd "$APP_DIR" && JAMMER_FIRMWARE_BIN="$JAMMER_FIRMWARE_BIN" npm run jammer:publish &>/dev/null; then
      ok "Прошивка глушилки: опубликована (источник: $JAMMER_SRC)"
    else
      warn "Прошивка глушилки: файл есть, но npm run jammer:publish не удался"
    fi
  else
    warn "Jammer .bin missing: put esp8266_deauther.bin in ${JAMMER_FIRMWARE_BIN} then npm run jammer:publish"
  fi
fi

# ═══════════════════════════════════════════════════════════════
# 7. .ENV ФАЙЛ
# ═══════════════════════════════════════════════════════════════
install_phase "Файл .env"
info "Создаём конфигурацию..."

if [ -z "${JWT_SECRET:-}" ]; then
  if command -v openssl &>/dev/null; then
    JWT_SECRET=$(openssl rand -hex 32)
  elif command -v python3 &>/dev/null; then
    JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
  else
    JWT_SECRET=$(_gen_hex32)
  fi
  info "JWT_SECRET сгенерирован (${#JWT_SECRET} hex-символов), только в .env"
else
  info "JWT_SECRET задан при опросе (${#JWT_SECRET} символов)"
fi

if [ "$MODE" = "prod" ]; then
  VITE_API_URL="https://${DOMAIN}/api"
  VITE_API_TARGET="https://${DOMAIN}"
  APP_URL_VAL="https://${DOMAIN}"
  APP_ENV_VAL="production"
  GOOGLE_CALLBACK_URL="${APP_URL_VAL}/api/auth/google/callback"
elif [ "$PLATFORM" = "termux" ]; then
  VITE_API_URL="http://127.0.0.1:${API_PORT}/api"
  VITE_API_TARGET="http://127.0.0.1:${API_PORT}"
  APP_URL_VAL="http://127.0.0.1:${API_PORT}"
  APP_ENV_VAL="development"
else
  VITE_API_URL="https://localhost/api"
  VITE_API_TARGET="https://localhost"
  APP_URL_VAL="https://localhost"
  APP_ENV_VAL="development"
fi

DSL_SANDBOX_MODE_VAL="auto"
DSL_SANDBOX_NETWORK_VAL="host"
[ "$APP_ENV_VAL" = "production" ] && DSL_SANDBOX_MODE_VAL="enforced"
[ "$PLATFORM" = "termux" ] && DSL_SANDBOX_MODE_VAL="disabled"

NODE_ENV_VAL="production"
AUTH_BYPASS_VAL="0"
if [ "$APP_ENV_VAL" = "development" ]; then
  NODE_ENV_VAL="development"
fi
if [ "$PLATFORM" = "termux" ]; then
  AUTH_BYPASS_VAL="1"
elif [ "$MODE" = "local" ]; then
  AUTH_BYPASS_VAL="1"
fi

if [ "$PLATFORM" = "termux" ]; then
  API_HOST_VAL="127.0.0.1"
  API_LISTEN_HOST_VAL="127.0.0.1"
else
  API_HOST_VAL="0.0.0.0"
  API_LISTEN_HOST_VAL="0.0.0.0"
fi

ESPHOME_BIN_VAL=""
PIO_BIN_VAL=""
DISABLE_FIRMWARE_RUNTIME_VAL="${DISABLE_FIRMWARE_RUNTIME:-0}"
if [ "$PLATFORM" = "termux" ]; then
  DISABLE_FIRMWARE_RUNTIME_VAL=1
else
  ESPHOME_BIN_VAL="${ESPHOME_BIN:-}"
  if [ -z "$ESPHOME_BIN_VAL" ] && [ -n "${ESPHOME_BIN_PATH:-}" ] && [ -f "$ESPHOME_BIN_PATH" ]; then
    ESPHOME_BIN_VAL="$ESPHOME_BIN_PATH"
  fi
  if [ -z "$ESPHOME_BIN_VAL" ] && [ -x "${APP_DIR}/.venv-esphome/bin/esphome" ]; then
    ESPHOME_BIN_VAL="${APP_DIR}/.venv-esphome/bin/esphome"
  fi

  PIO_BIN_VAL="${PIO_BIN:-}"
  if [ -z "$PIO_BIN_VAL" ] && [ -n "${PIO_BIN_PATH:-}" ] && [ -f "$PIO_BIN_PATH" ]; then
    PIO_BIN_VAL="$PIO_BIN_PATH"
  fi
  if [ -z "$PIO_BIN_VAL" ] && [ -x "${APP_DIR}/.venv-esphome/bin/pio" ]; then
    PIO_BIN_VAL="${APP_DIR}/.venv-esphome/bin/pio"
  fi
  PIO_BIN_VAL="${PIO_BIN_VAL:-pio}"
fi

# Расширенные переменные (.env как в production / webinstall)
PYTHON="${PYTHON:-}"
CICADA_TG_ROOT="${CICADA_TG_ROOT:-}"
AI_PROVIDER="${AI_PROVIDER:-}"
GROQ_MODEL="${GROQ_MODEL:-llama-3.3-70b-versatile}"
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"
ANTHROPIC_MODEL="${ANTHROPIC_MODEL:-claude-sonnet-4-6}"
ANTHROPIC_BASE_URL="${ANTHROPIC_BASE_URL:-https://api.anthropic.com/v1}"
ESP_FLASH_ADMIN_TOKEN="${ESP_FLASH_ADMIN_TOKEN:-}"
FIRMWARE_WORKSPACE_ROOT="${FIRMWARE_WORKSPACE_ROOT:-}"
DEFAULT_CHAT_ID="${DEFAULT_CHAT_ID:-}"
CORS_ORIGINS="${CORS_ORIGINS:-}"
JWT_EXPIRES_SEC="${JWT_EXPIRES_SEC:-604800}"
FIRMWARE_DOWNLOAD_TTL_MS="${FIRMWARE_DOWNLOAD_TTL_MS:-3600000}"
ESPHOME_CLEANUP_INTERVAL_MS="${ESPHOME_CLEANUP_INTERVAL_MS:-300000}"
FIRMWARE_BUILD_TIMEOUT_MS="${FIRMWARE_BUILD_TIMEOUT_MS:-1800000}"
ESPHOME_PLATFORMIO_HOME="${ESPHOME_PLATFORMIO_HOME:-${APP_DIR}/.cache/platformio}"
ESPHOME_JOBS_ROOT="${ESPHOME_JOBS_ROOT:-/tmp/esphome-jobs}"
ESPHOME_MAX_CONCURRENT_BUILDS="${ESPHOME_MAX_CONCURRENT_BUILDS:-2}"
ESPHOME_PUBLIC_BUILD="${ESPHOME_PUBLIC_BUILD:-0}"
JAMMER_FIRMWARE_BIN="${JAMMER_FIRMWARE_BIN:-${APP_DIR}/public/firmware/esp8266_deauther.bin}"
FIRMWARE_ENV_BLOCK=""
if [ "$PLATFORM" = "termux" ]; then
  FIRMWARE_ENV_BLOCK="# ─── ESPHome / прошивки — отключено на Termux ───────────────
DISABLE_FIRMWARE_RUNTIME=1"
else
  FIRMWARE_ENV_BLOCK="# ─── ESPHome / прошивки (/esphome, /api/esp/*) ───────────────
ESPHOME_BIN=${ESPHOME_BIN_VAL}
PIO_BIN=${PIO_BIN_VAL}
ESPHOME_JOBS_ROOT=${ESPHOME_JOBS_ROOT}
ESPHOME_MAX_CONCURRENT_BUILDS=${ESPHOME_MAX_CONCURRENT_BUILDS}
FIRMWARE_DOWNLOAD_TTL_MS=${FIRMWARE_DOWNLOAD_TTL_MS}
ESPHOME_CLEANUP_INTERVAL_MS=${ESPHOME_CLEANUP_INTERVAL_MS}
FIRMWARE_BUILD_TIMEOUT_MS=${FIRMWARE_BUILD_TIMEOUT_MS}
ESPHOME_PLATFORMIO_HOME=${ESPHOME_PLATFORMIO_HOME}
ESPHOME_PUBLIC_BUILD=${ESPHOME_PUBLIC_BUILD}
JAMMER_FIRMWARE_BIN=${JAMMER_FIRMWARE_BIN}"
fi

PYTHON_LINE="# PYTHON=/usr/bin/python3"
[ -n "$PYTHON" ] && PYTHON_LINE="PYTHON=${PYTHON}"

CICADA_TG_ROOT_LINE="# CICADA_TG_ROOT=${APP_DIR}"
[ -n "$CICADA_TG_ROOT" ] && CICADA_TG_ROOT_LINE="CICADA_TG_ROOT=${CICADA_TG_ROOT}"

ESPHOME_BIN_LINE="# ESPHOME_BIN=${APP_DIR}/.venv-esphome/bin/esphome"
[ -n "$ESPHOME_BIN_VAL" ] && ESPHOME_BIN_LINE="ESPHOME_BIN=${ESPHOME_BIN_VAL}"

FIRMWARE_WS_LINE="# FIRMWARE_WORKSPACE_ROOT=${APP_DIR}"
[ -n "$FIRMWARE_WORKSPACE_ROOT" ] && FIRMWARE_WS_LINE="FIRMWARE_WORKSPACE_ROOT=${FIRMWARE_WORKSPACE_ROOT}"

CORS_LINE="# CORS_ORIGINS=${APP_URL_VAL}"
[ -n "$CORS_ORIGINS" ] && CORS_LINE="CORS_ORIGINS=${CORS_ORIGINS}"

cat > "$APP_DIR/.env" << ENV
# ─── Server ──────────────────────────────────────────────────
NODE_ENV=${NODE_ENV_VAL}
APP_ENV=${APP_ENV_VAL}
AUTH_BYPASS=${AUTH_BYPASS_VAL}
API_HOST=${API_HOST_VAL}
API_LISTEN_HOST=${API_LISTEN_HOST_VAL}
API_PORT=${API_PORT}
DOMAIN=${DOMAIN}
PYTHON_BIN=${PYTHON}
BOT_PYTHON_VENV=${BOT_PYTHON_VENV}
${PYTHON_LINE}
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
GOOGLE_CALLBACK_URL=${GOOGLE_CALLBACK_URL}
APP_URL=${APP_URL_VAL}

DSL_SANDBOX_NETWORK=${DSL_SANDBOX_NETWORK_VAL}

ESP_FLASH_ADMIN_TOKEN=${ESP_FLASH_ADMIN_TOKEN}
${FIRMWARE_WS_LINE}

OLLAMA_URL=${OLLAMA_URL}
OLLAMA_MODEL=${OLLAMA_MODEL}
GROQ_TOKEN=${GROQ_TOKEN}
GROQ_TOKEN_2=${GROQ_TOKEN_2}
GROQ_TOKEN_3=${GROQ_TOKEN_3}

ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
ANTHROPIC_MODEL=${ANTHROPIC_MODEL}
ANTHROPIC_BASE_URL=${ANTHROPIC_BASE_URL}

DSL_MAX_RUNTIME_MS=300000
DSL_MAX_CODE_BYTES=100000
DSL_MAX_LOG_CHARS=80000
DSL_SANDBOX_MODE=${DSL_SANDBOX_MODE_VAL}

# ─── Vite (фронт) ────────────────────────────────────────────
VITE_API_URL=${VITE_API_URL}
VITE_API_TARGET=${VITE_API_TARGET}
VITE_ADMIN_EMAIL=${ADMIN_EMAIL}
VITE_ADMIN_NAME=${ADMIN_NAME}
VITE_TG_BOT_NAME=${TG_BOT_NAME}

# ─── PostgreSQL ───────────────────────────────────────────────
DB_HOST=localhost
DB_PORT=5432
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}

# ─── Безопасность ────────────────────────────────────────────
JWT_EXPIRES_SEC=${JWT_EXPIRES_SEC}
ADMIN_KEY=${ADMIN_KEY}
${CORS_LINE}
ADMIN_TOTP_SECRET=${ADMIN_TOTP_SECRET}
JWT_SECRET=${JWT_SECRET}

# ─── Email ───────────────────────────────────────────────────
RESEND_API_KEY=${RESEND_API_KEY}
EMAIL_FROM=${EMAIL_FROM}

# ─── Telegram ────────────────────────────────────────────────
TG_BOT_TOKEN=${TG_BOT_TOKEN}

# ─── CryptoBot ───────────────────────────────────────────────
CRYPTOBOT_TOKEN=${CRYPTOBOT_TOKEN}

GROQ_MODEL=${GROQ_MODEL}
AI_PROVIDER=${AI_PROVIDER}
DEFAULT_CHAT_ID=${DEFAULT_CHAT_ID}

${FIRMWARE_ENV_BLOCK}
ENV

chmod 600 "$APP_DIR/.env"
ok ".env создан (права 600)"

# Termux: очистка битых строк ESPHome/JAMMER из старых .env
if [ "$PLATFORM" = "termux" ] && [ -f "$APP_DIR/.env" ]; then
  _env_tmp="${APP_DIR}/.env.termux-fix.$$"
  grep -v -E '^(ESPHOME_BIN|PIO_BIN|ESPHOME_JOBS_ROOT|JAMMER_FIRMWARE_BIN|FIRMWARE_WORKSPACE_ROOT|DB_TYPE)=' \
    "$APP_DIR/.env" 2>/dev/null | grep -v -E '^(if |cat |ENV_ESP|fi$)' >"$_env_tmp" || cp "$APP_DIR/.env" "$_env_tmp"
  if ! grep -q '^DISABLE_FIRMWARE_RUNTIME=1' "$_env_tmp" 2>/dev/null; then
    echo "DISABLE_FIRMWARE_RUNTIME=1" >>"$_env_tmp"
  fi
  if ! grep -q '^AUTH_BYPASS=1' "$_env_tmp" 2>/dev/null; then
    sed -i 's/^AUTH_BYPASS=.*/AUTH_BYPASS=1/' "$_env_tmp" 2>/dev/null \
      || echo "AUTH_BYPASS=1" >>"$_env_tmp"
  fi
  mv -f "$_env_tmp" "$APP_DIR/.env"
  chmod 600 "$APP_DIR/.env"
  ok "Termux: .env очищен (AUTH_BYPASS, DISABLE_FIRMWARE_RUNTIME)"
fi

sync_runtime_env_file

# ═══════════════════════════════════════════════════════════════
# 8. СБОРКА ФРОНТЕНДА
# ═══════════════════════════════════════════════════════════════
if [ -f "$APP_DIR/package.json" ]; then
  install_phase "Сборка фронтенда (Vite)"
  prune_legacy_core_paths
  info "npm run build..."
  cd "$APP_DIR"
  if ! npm run build 2>${CICADA_ERR_DIR}/cicada_build_err; then
    warn "Сборка фронтенда не удалась. Причина:"
    tail -20 ${CICADA_ERR_DIR}/cicada_build_err >&2 || true
    warn "Для ручного запуска: cd ${APP_DIR} && npm run build"
  else
    ok "Фронтенд собран (dist/)"
  fi
  chmod -R 755 "$APP_DIR/dist" 2>/dev/null || true
  nginx_ensure_dist_readable
fi

# ═══════════════════════════════════════════════════════════════
# 9. NGINX КОНФИГ (только VPS и WSL)
# ═══════════════════════════════════════════════════════════════
if [ "$PLATFORM" != "termux" ]; then
  install_phase "Nginx"
  info "Конфигурируем reverse proxy..."
  NGINX_CONF="/etc/nginx/sites-available/cicada"

  if [ "$MODE" = "prod" ]; then
    $SUDO tee "$NGINX_CONF" > /dev/null << NGINX
server {
    listen 80;
    server_name ${DOMAIN};
    root ${APP_DIR}/dist;
    index index.html;

    location /.well-known/acme-challenge/ { root /var/www/html; }

    location = /satana {
        proxy_pass http://localhost:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location = /satana.html { return 301 /satana; }

    location /api/firmware/build {
        client_max_body_size 100M;
        proxy_pass http://localhost:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 900s;
        proxy_connect_timeout 60s;
        proxy_send_timeout 900s;
    }

    location /api/ {
        proxy_pass http://localhost:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location /firmware/ {
        proxy_pass http://localhost:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location ^~ /flash/ {
        proxy_pass http://localhost:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / { try_files \$uri \$uri/ /index.html; }
}
NGINX

  else
    info "Генерируем self-signed сертификат..."
    $SUDO mkdir -p /etc/ssl/cicada
    $SUDO openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout /etc/ssl/cicada/privkey.pem \
      -out /etc/ssl/cicada/fullchain.pem \
      -subj "/CN=localhost" &>/dev/null
    ok "Self-signed сертификат создан"

    $SUDO tee "$NGINX_CONF" > /dev/null << NGINX
server {
    listen 80;
    server_name localhost;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name localhost;

    ssl_certificate /etc/ssl/cicada/fullchain.pem;
    ssl_certificate_key /etc/ssl/cicada/privkey.pem;

    root ${APP_DIR}/dist;
    index index.html;

    location = /satana {
        proxy_pass http://localhost:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location = /satana.html { return 301 /satana; }

    location /api/firmware/build {
        client_max_body_size 100M;
        proxy_pass http://localhost:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 900s;
        proxy_connect_timeout 60s;
        proxy_send_timeout 900s;
    }

    location /api/ {
        proxy_pass http://localhost:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location /firmware/ {
        proxy_pass http://localhost:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location ^~ /flash/ {
        proxy_pass http://localhost:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / { try_files \$uri \$uri/ /index.html; }
}
NGINX
  fi

  $SUDO ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/cicada
  $SUDO rm -f /etc/nginx/sites-enabled/default
  if ! $SUDO nginx -t 2>${CICADA_ERR_DIR}/cicada_nginx_err; then
    warn "Nginx: ошибка в конфигурации:"
    cat ${CICADA_ERR_DIR}/cicada_nginx_err >&2 || true
    warn "Исправь конфиг вручную: ${NGINX_CONF}"
  else
    nginx_ensure_dist_readable
    svc_reload nginx
    ok "Nginx настроен (/firmware/ и /flash/ → Node:${API_PORT})"
  fi
fi

# ═══════════════════════════════════════════════════════════════
# 10. FIREWALL (VPS) — до Let's Encrypt, иначе порт 80 закрыт
# ═══════════════════════════════════════════════════════════════
if [ "$PLATFORM" = "vps" ]; then
  echo ""
  info "Настраиваем firewall (UFW)..."
  $SUDO ufw allow OpenSSH &>/dev/null || $SUDO ufw allow ssh &>/dev/null || true
  $SUDO ufw allow 80/tcp  &>/dev/null || true
  $SUDO ufw allow 443/tcp &>/dev/null || true
  $SUDO ufw --force enable &>/dev/null || warn "UFW: не удалось включить (проверь firewall хостинга)"
  ok "Firewall: порты 22, 80, 443"
else
  warn "Firewall (UFW) пропущен — не нужен на $PLATFORM"
fi

# ═══════════════════════════════════════════════════════════════
# 11. SSL — LET'S ENCRYPT (только PROD на VPS)
# ═══════════════════════════════════════════════════════════════
_server_public_ipv4() {
  curl -4 -s --max-time 8 https://api.ipify.org 2>/dev/null \
    || curl -4 -s --max-time 8 https://ifconfig.me/ip 2>/dev/null \
    || hostname -I 2>/dev/null | awk '{print $1}' \
    || true
}

_check_domain_points_here() {
  local domain=$1 server_ip resolved
  domain="${domain#https://}"
  domain="${domain#http://}"
  domain="${domain%%/*}"
  [ -z "$domain" ] || [ "$domain" = "localhost" ] && return 0
  server_ip=$(_server_public_ipv4)
  [ -z "$server_ip" ] && return 0
  resolved=$(getent ahostsv4 "$domain" 2>/dev/null | awk '{print $1; exit}')
  if [ -z "$resolved" ]; then
    warn "DNS: домен ${domain} пока не резолвится"
    hint "Добавь A-запись ${domain} → ${server_ip} и подожди 5–30 мин"
    return 1
  fi
  if [ "$resolved" != "$server_ip" ]; then
    warn "DNS: ${domain} → ${resolved}, IP сервера: ${server_ip}"
    hint "Let's Encrypt не выдаст сертификат, пока A-запись не укажет на этот VPS"
    return 1
  fi
  ok "DNS: ${domain} → ${server_ip}"
  return 0
}

if [ "$MODE" = "prod" ] && [ "$PLATFORM" = "vps" ]; then
  echo ""
  if [ "${SKIP_LE_SSL:-0}" = "1" ]; then
    warn "SKIP_LE_SSL=1 — пропускаем Let's Encrypt (сайт на http://${DOMAIN})"
  else
    info "Получаем SSL сертификат Let's Encrypt для ${DOMAIN}..."
    _check_domain_points_here "$DOMAIN" || true
    if ! command -v certbot &>/dev/null; then
      $SUDO apt-get install -y -qq certbot python3-certbot-nginx \
        || warn "Не удалось установить certbot"
    fi
    set +e
    $SUDO certbot --nginx \
      -d "$DOMAIN" \
      --email "${LE_EMAIL:-admin@${DOMAIN}}" \
      --agree-tos \
      --non-interactive \
      --redirect
    _certbot_rc=$?
    set -e
    if [ "$_certbot_rc" -eq 0 ]; then
      ok "SSL сертификат получен и настроен"
    else
      warn "Let's Encrypt не выдал сертификат (certbot exit ${_certbot_rc})"
      hint "1) A-запись ${DOMAIN} → $(_server_public_ipv4)  2) порты 80/443 открыты у хостера"
      hint "3) без «оранжевого облака» Cloudflare на время выпуска  4) повтор: sudo certbot --nginx -d ${DOMAIN}"
      hint "Временно без SSL: SKIP_LE_SSL=1 в .env и переустановка — сайт на http://${DOMAIN}"
    fi
    nginx_apply_prod_ssl_if_ready
  fi
fi

# ═══════════════════════════════════════════════════════════════
# 12. PM2 — ЗАПУСК СЕРВЕРА
# ═══════════════════════════════════════════════════════════════
install_phase "Запуск сервера (PM2)"
info "Стартуем Node.js..."
cd "$APP_DIR"

pm2 delete cicada-server 2>/dev/null || true
pm2 delete server 2>/dev/null || true

PM2_NODE_ENV="${NODE_ENV_VAL:-production}"
if [ -f "$APP_DIR/.env" ]; then
  _pm2_ne=$(grep -E '^NODE_ENV=' "$APP_DIR/.env" 2>/dev/null | tail -1 | cut -d= -f2- || true)
  [ -n "$_pm2_ne" ] && PM2_NODE_ENV="$_pm2_ne"
fi
PM2_APP_ENV="${APP_ENV_VAL:-$PM2_NODE_ENV}"

if [ ! -d "$APP_DIR/node_modules/tsx" ]; then
  err "Нет node_modules/tsx. Выполни: cd ${APP_DIR} && npm install --legacy-peer-deps"
fi
info "PM2: NODE_ENV=${PM2_NODE_ENV}, tsx, cwd=${APP_DIR}"
NODE_ENV="$PM2_NODE_ENV" APP_ENV="$PM2_APP_ENV" pm2 start server.mjs \
  --name cicada-server \
  --node-args="--import tsx" \
  --cwd "$APP_DIR"
pm2 save

sleep 2
if command -v ss &>/dev/null && ss -tln 2>/dev/null | grep -q ":${API_PORT} "; then
  ok "API слушает порт ${API_PORT}"
elif command -v lsof &>/dev/null && lsof -i ":${API_PORT}" &>/dev/null; then
  ok "API слушает порт ${API_PORT}"
else
  warn "Порт ${API_PORT} пока не слушается — проверь: pm2 logs cicada-server"
fi
if [ "$PM2_NODE_ENV" = "development" ]; then
  hint "AI Debug IDE: http://127.0.0.1:${API_PORT}/debug.html (только development)"
elif [ "$MODE" = "prod" ]; then
  dim "AI Debug IDE отключена в production (нужен NODE_ENV=development)"
fi

if $HAS_SYSTEMCTL && [ "$PLATFORM" = "vps" ]; then
  pm2 startup systemd -u root --hp /root &>/dev/null || true
  ok "PM2 autostart настроен (systemd)"
elif [ "$PLATFORM" = "termux" ]; then
  if [ -d "$HOME/.termux/boot" ]; then
    cat > "$HOME/.termux/boot/cicada.sh" << BOOT
#!/data/data/com.termux/files/usr/bin/bash
pg_ctl -D "\$PREFIX/var/lib/postgresql" start
cd "${APP_DIR}" && pm2 resurrect
BOOT
    chmod +x "$HOME/.termux/boot/cicada.sh"
    ok "Автозапуск настроен через Termux:Boot"
  else
    warn "Установи приложение Termux:Boot для автозапуска при перезагрузке"
  fi
else
  warn "Автозапуск PM2: настрой вручную (systemctl или rc.local)"
fi

ok "Сервер запущен через PM2"

# ─── Локальный админ: учётка + pro ─────────────────────────────
wait_for_users_table() {
  local i
  for i in $(seq 1 45); do
    if pgsql_super -d "$DB_NAME" -tAc \
      "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users'" \
      2>/dev/null | grep -q 1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

seed_local_admin_account() {
  [ "$PLATFORM" = "termux" ] && return 0
  [ "$MODE" != "local" ] && return 0
  [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_PASSWORD" ] && return 0

  echo ""
  info "Создаём учётную запись для входа ($ADMIN_EMAIL)..."
  wait_for_users_table || {
    warn "Таблица users не появилась — зарегистрируйся в UI или повтори bootstrap"
    return 1
  }

  cd "$APP_DIR"
  if ADMIN_EMAIL="$ADMIN_EMAIL" ADMIN_PASSWORD="$ADMIN_PASSWORD" ADMIN_NAME="${ADMIN_NAME:-Admin}" \
     DB_HOST="localhost" DB_PORT="5432" DB_NAME="$DB_NAME" DB_USER="$DB_USER" DB_PASSWORD="$DB_PASSWORD" \
     node --input-type=module <<'SEED'
import pg from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';
const name = (process.env.ADMIN_NAME || 'Admin').trim().slice(0, 64) || 'Admin';
if (!email || password.length < 8) process.exit(2);

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const hash = bcrypt.hashSync(password, 10);
const exp = 9999999999999;

try {
  const existing = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
  if (existing.rowCount > 0) {
    await pool.query(
      `UPDATE users SET name=$1, password=$2, verified=TRUE, verify_token=NULL, verify_token_exp=NULL,
       plan='pro', role='admin', subscription_exp=$3 WHERE email=$4`,
      [name, hash, exp, email],
    );
  } else {
    await pool.query(
      `INSERT INTO users (id, name, email, password, verified, plan, role, subscription_exp)
       VALUES ($1,$2,$3,$4,TRUE,'pro','admin',$5)`,
      [crypto.randomUUID(), name, email, hash, exp],
    );
  }
} finally {
  await pool.end();
}
SEED
  then
    ok "Вход готов: $ADMIN_EMAIL (email подтверждён, роль admin, план pro)"
  else
    warn "Не удалось создать учётку — проверь pm2 logs cicada-server и подключение к БД"
  fi
}

grant_admin_privileges() {
  [ -z "$ADMIN_EMAIL" ] && return 0
  local email_lc
  email_lc=$(echo "$ADMIN_EMAIL" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')
  pgsql_super -d "$DB_NAME" -c \
    "UPDATE users SET plan='pro', role='admin', subscription_exp=9999999999999 WHERE lower(trim(email))='${email_lc}';" \
    &>/dev/null || true
}

if [ "$MODE" = "local" ] && [ -n "$ADMIN_PASSWORD" ]; then
  sleep 2
  seed_local_admin_account || warn "Создание локального админа не удалось — зарегистрируйся в UI"
elif [ -n "$ADMIN_EMAIL" ]; then
  echo ""
  info "Выдаём pro-план администратору ($ADMIN_EMAIL)..."
  sleep 3
  grant_admin_privileges \
    && ok "Pro-план и роль admin выданы администратору" \
    || warn "Пользователь ${ADMIN_EMAIL} ещё не зарегистрирован — зайди в аккаунт и затем выполни вручную:
    sudo -u postgres psql -d ${DB_NAME} -c \"UPDATE users SET plan='pro', role='admin', subscription_exp=9999999999999 WHERE email='${ADMIN_EMAIL}';\""
fi

# ═══════════════════════════════════════════════════════════════
# 13. ПРОВЕРКА
# ═══════════════════════════════════════════════════════════════
install_phase "Проверка установки"
info "Финальная диагностика..."
sleep 5

_run_check() {
  local label=$1 secs=$2
  shift 2
  if command -v timeout &>/dev/null; then
    if timeout "$secs" "$@" &>/dev/null; then
      ok "$label"
      return 0
    fi
  elif "$@" &>/dev/null; then
    ok "$label"
    return 0
  fi
  warn "$label — проверка не прошла (таймаут ${secs}с или сервис недоступен)"
  hint "Некритично для завершения установки — см. pm2 logs cicada-server"
  return 0
}

if [ "$PLATFORM" = "termux" ]; then
  warn "Termux: пропускаем проверку таблицы users (создаётся при старте приложения)"
else
  _run_check "PostgreSQL: таблица users существует" 30 \
    pgsql_super -d "$DB_NAME" -c "SELECT COUNT(*) FROM users;" || true
fi

if command -v timeout &>/dev/null; then
  timeout 45 pm2 list 2>/dev/null | grep -q "online" \
    && ok "PM2: сервер online" \
    || warn "PM2: сервер может не запуститься сразу — проверь: pm2 logs cicada-server"
else
  pm2 list 2>/dev/null | grep -q "online" \
    && ok "PM2: сервер online" \
    || warn "PM2: сервер может не запуститься сразу — проверь: pm2 logs cicada-server"
fi

if [ "$PLATFORM" != "termux" ]; then
  svc_is_active nginx \
    && ok "Nginx: работает" \
    || warn "Nginx: не работает"
fi

if [ -f "$APP_DIR/dist/index.html" ]; then
  ok "Фронтенд: dist/index.html на месте"
  nginx_ensure_dist_readable 2>/dev/null || true
else
  warn "Нет dist/index.html — сайт даст 500/404. Выполни: cd ${APP_DIR} && npm run build"
fi

if curl -fsS --max-time 8 "http://127.0.0.1:${API_PORT}/api/health" >/dev/null 2>&1; then
  ok "API: /api/health отвечает на порту ${API_PORT}"
else
  warn "API не отвечает на :${API_PORT} — pm2 logs cicada-server"
fi

if [ "$MODE" = "prod" ] && [ -n "${DOMAIN:-}" ] && command -v curl &>/dev/null; then
  _site_code=$(curl -k -s -o /dev/null -w '%{http_code}' --max-time 12 "https://${DOMAIN}/" 2>/dev/null || echo "000")
  case "$_site_code" in
    200|301|302|304) ok "Сайт https://${DOMAIN}/ → HTTP ${_site_code}" ;;
    500|502|503)
      warn "Сайт https://${DOMAIN}/ → HTTP ${_site_code} (nginx/бэкенд)"
      hint "sudo tail -20 /var/log/nginx/error.log"
      hint "pm2 logs cicada-server --lines 40"
      ;;
    *) warn "Сайт https://${DOMAIN}/ → HTTP ${_site_code} (ожидали 200)" ;;
  esac
fi

if [ -n "$ESPHOME_BIN_PATH" ] && [ -x "$ESPHOME_BIN_PATH" ]; then
  if command -v timeout &>/dev/null; then
    _esphome_cli_ver=$(timeout 45 "$ESPHOME_BIN_PATH" version 2>/dev/null | head -1)
  else
    _esphome_cli_ver=$("$ESPHOME_BIN_PATH" version 2>/dev/null | head -1)
  fi
  ok "ESPHome CLI: ${_esphome_cli_ver:-установлен}"
elif [ "$INSTALL_ESPHOME" = "1" ]; then
  warn "ESPHome: бинарник не найден — проверь .venv-esphome"
fi

# ═══════════════════════════════════════════════════════════════
# 14. ИТОГ
# ═══════════════════════════════════════════════════════════════
ui_refresh_layout
echo ""
_done_bw=$((UI_INNER + 8))
if [ "$UI_NARROW" = "1" ]; then
  echo -e "${GREEN}  ╔$(ui_repeat '═' "$_done_bw")╗${NC}"
  echo -e "${GREEN}  ║${NC} ${BOLD}${WHITE}✔ УСТАНОВКА ЗАВЕРШЕНА${NC}              ${GREEN}║${NC}"
  echo -e "${GREEN}  ║${NC} ${GRAY}Cicada Studio готова${NC}               ${GREEN}║${NC}"
  echo -e "${GREEN}  ╚$(ui_repeat '═' "$_done_bw")╝${NC}"
else
  echo -e "${GREEN}  ╔$(ui_repeat '═' "$_done_bw")╗${NC}"
  echo -e "${GREEN}  ║$(ui_repeat ' ' "$_done_bw")║${NC}"
  echo -e "${GREEN}  ║${NC}  ${BOLD}${WHITE}✔  УСТАНОВКА ЗАВЕРШЕНА${NC}                         ${GREEN}  ║${NC}"
  echo -e "${GREEN}  ║${NC}  ${GRAY}Cicada Studio готова к работе${NC}                  ${GREEN}  ║${NC}"
  echo -e "${GREEN}  ║$(ui_repeat ' ' "$_done_bw")║${NC}"
  echo -e "${GREEN}  ╚$(ui_repeat '═' "$_done_bw")╝${NC}"
fi
echo ""

summary_panel_begin "Доступ" "$CYAN"

if [ "$MODE" = "prod" ]; then
  summary_row "Сайт" "https://${DOMAIN}" "$GREEN"
  summary_row "Админка" "https://${DOMAIN}/satana" "$ORANGE"
  summary_row "ESPHome" "https://${DOMAIN}/esphome/" "$CYAN"
elif [ "$PLATFORM" = "termux" ]; then
  summary_row "Сайт" "http://127.0.0.1:${API_PORT}" "$GREEN"
  summary_row "Админка" "/satana" "$ORANGE"
  summary_row "ESPHome" "отключён" "$DIM"
  if [ "${AUTH_BYPASS_VAL:-0}" = "1" ]; then
    summary_row "Вход" "не требуется (AUTH_BYPASS)" "$GREEN"
  elif [ "$MODE" = "local" ] && [ -n "$ADMIN_EMAIL" ]; then
    summary_row "Вход" "${ADMIN_EMAIL}" "$WHITE"
  fi
  dim "Termux: http://127.0.0.1:${API_PORT} — mock-пользователь без логина"
else
  summary_row "Сайт" "https://localhost" "$GREEN"
  summary_row "Админка" "https://localhost/satana" "$ORANGE"
  summary_row "ESPHome" "https://localhost/esphome/" "$CYAN"
  if [ "${AUTH_BYPASS_VAL:-0}" = "1" ]; then
    summary_row "Вход" "без пароля (AUTH_BYPASS)" "$GREEN"
  fi
  if [ "$MODE" = "local" ] && [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
    summary_row "Админ Studio" "${ADMIN_EMAIL}" "$ORANGE"
    dim "Пароль: ${ADMIN_PASSWORD} · роль admin · план pro"
  fi
  dim "Предупреждение о сертификате — норма для LOCAL"
fi

if [ -n "$ESPHOME_BIN_PATH" ]; then
  summary_row "ESPHome CLI" "$(ui_shorten "$ESPHOME_BIN_PATH" "$((UI_INNER - 2))")" "$DIM"
elif [ "$INSTALL_ESPHOME" != "1" ] && [ "$PLATFORM" != "termux" ]; then
  summary_row "ESPHome" "не установлен" "$YELLOW"
fi

if [ "$PLATFORM" != "termux" ]; then
  if [ -f "${JAMMER_FIRMWARE_BIN}" ] || [ -f "$APP_DIR/public/flash/jammer/esp8266_deauther.bin" ]; then
    summary_row "Глушилка" "/flash/jammer/ OK" "$GREEN"
  else
    summary_row "Глушилка" "нет .bin" "$YELLOW"
  fi
fi

summary_panel_end "$CYAN"

summary_panel_begin "Система" "$MAGENTA"
summary_row "Платформа" "$PLATFORM" "$TEAL"
summary_row "БД" "${DB_NAME} / ${DB_USER}" "$WHITE"
summary_row "ADMIN_KEY" "$(ui_shorten "$ADMIN_KEY" "$((UI_INNER - 2))")" "$DIM"
if [ "$MODE" = "local" ] && [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
  summary_row "Логин" "$ADMIN_EMAIL" "$ORANGE"
fi
summary_row "Папка" "$(ui_shorten "$APP_DIR" "$((UI_INNER - 2))")" "$CYAN"
summary_panel_end "$MAGENTA"

echo ""
echo -e "  ${BOLD}${WHITE}Команды${NC}"
if [ "$UI_NARROW" = "1" ]; then
  echo -e "  ${TEAL}pm2 logs cicada-server${NC} ${GRAY}— логи${NC}"
  echo -e "  ${TEAL}pm2 restart cicada-server${NC} ${GRAY}— рестарт${NC}"
  if [ "$PLATFORM" != "termux" ]; then
    echo -e "  ${TEAL}sudo systemctl reload nginx${NC}"
  else
    echo -e "  ${TEAL}psql -U $(whoami) -d ${DB_NAME}${NC} ${GRAY}— БД${NC}"
  fi
else
  echo -e "  ${GRAY}┌$(ui_repeat '─' $((UI_INNER + 4)))┐${NC}"
  echo -e "  ${GRAY}│${NC}  ${TEAL}pm2 logs cicada-server${NC}        ${GRAY}— просмотр логов${NC}"
  echo -e "  ${GRAY}│${NC}  ${TEAL}pm2 restart cicada-server${NC}     ${GRAY}— перезапуск сервера${NC}"
  if [ "$PLATFORM" != "termux" ]; then
    echo -e "  ${GRAY}│${NC}  ${TEAL}nginx -t && sudo systemctl reload nginx${NC}  ${GRAY}— nginx${NC}"
  fi
  if [ "$PLATFORM" = "termux" ]; then
    echo -e "  ${GRAY}│${NC}  ${TEAL}psql -U $(whoami) -d ${DB_NAME}${NC}  ${GRAY}— консоль БД${NC}"
  else
    echo -e "  ${GRAY}│${NC}  ${TEAL}sudo -u postgres psql -d ${DB_NAME}${NC}  ${GRAY}— консоль БД${NC}"
  fi
  echo -e "  ${GRAY}└$(ui_repeat '─' $((UI_INNER + 4)))┘${NC}"
fi
echo ""
hint ".env → ${CYAN}$(ui_shorten "${APP_DIR}/.env" 48)${NC}"
echo ""
