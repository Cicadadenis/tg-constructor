#!/usr/bin/env python3
"""
Cicada Studio — веб-установщик (один файл, без зависимостей).

  python3 webinstall.py
  → HTTP на 0.0.0.0:7700, ufw (VPS), открытие браузера где возможно

  python3 webinstall.py --direct
  → установка из .env в терминале (без веб-UI)

  WEBINSTALL_PUBLIC_URL=http://домен:7700  — свой URL в консоли
  WEBINSTALL_SKIP_FIREWALL=1             — не трогать ufw
  WEBINSTALL_NO_FREE_PORT=1              — не убивать процесс на 7700
  WEBINSTALL_UFW_ENABLE=0                — не включать ufw автоматически

Форма → webinstall/last-install.env → setup.sh --webinstall (логи по SSE).
"""
from __future__ import annotations

import json
import os
import platform
import queue
import secrets
import shutil
import socket
import subprocess
import sys
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, urlparse

# errno: EADDRINUSE (Linux/macOS/WSL) and WSAEADDRINUSE (Windows)
_ADDR_IN_USE = {98, 48, 10048}

ROOT = Path(__file__).resolve().parent
BOOTSTRAP_SH = ROOT / "bootstrap.sh"
SETUP_SH = ROOT / "setup.sh"
WEBINSTALL_DIR = ROOT / "webinstall"
ENV_FILE = WEBINSTALL_DIR / "last-install.env"
PORT = int(os.environ.get("WEBINSTALL_PORT", "7700"))
HOST = os.environ.get("WEBINSTALL_HOST", "0.0.0.0")

_jobs: dict[str, dict] = {}
_jobs_lock = threading.Lock()
_install_lock = threading.Lock()

_LOOPBACK_HOSTS = frozenset({"localhost", "127.0.0.1", "0.0.0.0", "::", ""})
_TLS_HINT_REQUESTLINE = "- HTTPS/TLS on HTTP port -"
_TLS_LOG_LAST: dict[str, float] = {}
_TLS_LOG_INTERVAL_SEC = 300


def _configure_console() -> None:
    """Windows cp1251 consoles fail on emoji; prefer UTF-8 when supported."""
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            try:
                reconfigure(encoding="utf-8", errors="replace")
            except (OSError, ValueError):
                pass


def detect_platform() -> str:
    if os.environ.get("TERMUX_VERSION") or Path("/data/data/com.termux").is_dir():
        return "termux"
    try:
        ver = Path("/proc/version").read_text(encoding="utf-8", errors="ignore").lower()
        if "microsoft" in ver or "wsl" in ver:
            return "wsl"
    except OSError:
        pass
    return "vps"


PLATFORM_LABELS = {
    "vps": "сервер Linux",
    "termux": "Termux",
    "wsl": "WSL",
}


def shell_quote(value: str) -> str:
    return "'" + value.replace("'", "'\"'\"'") + "'"


def parse_env_file(path: Path) -> dict[str, str]:
    """Читает .env файл и возвращает словарь переменных."""
    result = {}
    if not path.is_file():
        return result
    
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip()
            # Удаляем кавычки если есть
            if value.startswith("'") and value.endswith("'"):
                value = value[1:-1]
            elif value.startswith('"') and value.endswith('"'):
                value = value[1:-1]
            result[key] = value
    return result


def process_env_file(env_path: Path) -> dict[str, str]:
    """Загружает и обрабатывает .env файл, добавляя DOMAIN если есть API_HOST."""
    env_data = parse_env_file(env_path)
    
    # Если DOMAIN не задан, но есть API_HOST (не 0.0.0.0), используем как DOMAIN
    if not env_data.get("DOMAIN") and env_data.get("API_HOST"):
        api_host = env_data["API_HOST"].strip()
        if api_host.lower() not in _LOOPBACK_HOSTS:
            env_data["DOMAIN"] = api_host
    
    # Определяем режим на основе DOMAIN
    if env_data.get("DOMAIN") and env_data["DOMAIN"] != "localhost":
        env_data["MODE"] = "prod"
        env_data["MODE_CHOICE"] = "1"
        env_data["PREVIEW_APP_URL"] = f"https://{env_data['DOMAIN']}"
    else:
        env_data["MODE"] = "local"
        env_data["MODE_CHOICE"] = "2"
        port = env_data.get("API_PORT", "3001")
        if detect_platform() == "termux":
            env_data["PREVIEW_APP_URL"] = f"http://127.0.0.1:{port}"
            env_data["AUTH_BYPASS"] = env_data.get("AUTH_BYPASS", "1")
        else:
            env_data["PREVIEW_APP_URL"] = "https://localhost"

    return env_data


def write_env_file(path: Path, data: dict[str, str]) -> None:
    WEBINSTALL_DIR.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Сгенерировано webinstall.py",
        f"# {time.strftime('%Y-%m-%d %H:%M:%S')}",
        "",
    ]
    for key in sorted(data.keys()):
        val = data[key]
        if val is None:
            val = ""
        lines.append(f"{key}={shell_quote(str(val))}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    path.chmod(0o600)


def build_config(body: dict) -> dict[str, str]:
    platform = detect_platform()
    mode = (body.get("mode") or "local").strip().lower()
    if platform == "termux":
        mode = "local"

    domain = (body.get("domain") or "").strip()
    le_email = (body.get("le_email") or "").strip()
    api_port = str(body.get("api_port") or "3001").strip()
    db_name = (body.get("db_name") or "cicada").strip()
    db_user = (body.get("db_user") or "cicada_user").strip()
    db_password = body.get("db_password") or ""
    admin_email = (body.get("admin_email") or "").strip()
    admin_name = (body.get("admin_name") or "Admin").strip()
    admin_password = body.get("admin_password") or ""
    tg_token = (body.get("tg_bot_token") or "").strip()
    tg_name = (body.get("tg_bot_name") or "").strip()
    install_esphome = body.get("install_esphome") is True
    esphome_pin = (body.get("esphome_pin") or "").strip()

    if mode == "prod":
        if not domain:
            raise ValueError("Укажите домен для PROD")
        if not le_email:
            raise ValueError("Укажите email для Let's Encrypt")
        mode_choice = "1"
        preview = f"https://{domain}"
    else:
        domain = "localhost"
        le_email = ""
        mode_choice = "2"
        preview = "https://localhost"

    if len(db_password) < 8:
        raise ValueError("Пароль БД — минимум 8 символов")

    if platform == "termux":
        mode = "local"
        mode_choice = "2"
        domain = "localhost"
        le_email = ""
        preview = f"http://127.0.0.1:{api_port}"
        admin_email = admin_email or "admin@local"
        admin_password = ""
    elif mode == "local":
        admin_email = admin_email or "denisbednakov@gmail.com"
        if not admin_password:
            admin_password = "cicada3301"
        if len(admin_password) < 8:
            raise ValueError("Пароль входа — минимум 8 символов (LOCAL)")
    elif not admin_email:
        raise ValueError("Email администратора обязателен")
    else:
        admin_password = admin_password or ""

    auto_admin_key = body.get("auto_admin_key") is not False
    admin_key = (body.get("admin_key") or "").strip()
    if auto_admin_key or not admin_key:
        admin_key = secrets.token_hex(32)
        use_admin_key = "y"
    else:
        if len(admin_key) < 12:
            raise ValueError("ADMIN_KEY — минимум 12 символов")
        use_admin_key = "n"

    auto_jwt = body.get("auto_jwt") is not False
    jwt_secret = (body.get("jwt_secret") or "").strip()
    if auto_jwt or not jwt_secret:
        jwt_secret = ""
        use_jwt_secret = "y"
    else:
        min_jwt = 32 if mode == "prod" else 8
        if len(jwt_secret) < min_jwt:
            raise ValueError(f"JWT_SECRET — минимум {min_jwt} символов")
        use_jwt_secret = "n"

    app_dir = str(ROOT)
    email_from = (body.get("email_from") or "").strip()
    if not email_from and mode == "prod":
        email_from = f"Cicada Studio <noreply@{domain}>"

    return {
        "APP_DIR": app_dir,
        "PLATFORM": platform,
        "MODE": mode,
        "MODE_CHOICE": mode_choice,
        "DOMAIN": domain,
        "LE_EMAIL": le_email,
        "PREVIEW_APP_URL": preview,
        "API_PORT": api_port,
        "DB_NAME": db_name,
        "DB_USER": db_user,
        "DB_PASSWORD": db_password,
        "ADMIN_KEY": admin_key,
        "USE_ADMIN_KEY": use_admin_key,
        "JWT_SECRET": jwt_secret,
        "USE_JWT_SECRET": use_jwt_secret,
        "JWT_EXPIRES_SEC": str(body.get("jwt_expires_sec") or "604800").strip(),
        "ADMIN_EMAIL": admin_email,
        "ADMIN_NAME": admin_name,
        "ADMIN_PASSWORD": admin_password,
        "TG_BOT_TOKEN": tg_token,
        "TG_BOT_NAME": tg_name,
        "RESEND_API_KEY": (body.get("resend_api_key") or "").strip(),
        "EMAIL_FROM": email_from,
        "CRYPTOBOT_TOKEN": (body.get("cryptobot_token") or "").strip(),
        "GOOGLE_CLIENT_ID": (body.get("google_client_id") or "").strip(),
        "GOOGLE_CLIENT_SECRET": (body.get("google_client_secret") or "").strip(),
        "GOOGLE_CALLBACK_URL": (
            body.get("google_callback_url") or f"{preview}/api/auth/google/callback"
        ).strip(),
        "PYTHON": (body.get("python") or "").strip(),
        "CICADA_TG_ROOT": (body.get("cicada_tg_root") or app_dir).strip(),
        "CORS_ORIGINS": (
            (body.get("cors_origins") or "").strip()
            or (preview if mode == "prod" else "")
        ),
        "AI_PROVIDER": (body.get("ai_provider") or "").strip(),
        "GROQ_TOKEN": (body.get("groq_token") or "").strip(),
        "GROQ_TOKEN_2": (body.get("groq_token_2") or "").strip(),
        "GROQ_TOKEN_3": (body.get("groq_token_3") or "").strip(),
        "GROQ_MODEL": (body.get("groq_model") or "llama-3.3-70b-versatile").strip(),
        "OLLAMA_URL": (body.get("ollama_url") or "https://api.groq.com/openai").strip(),
        "OLLAMA_MODEL": (body.get("ollama_model") or "llama-3.3-70b-versatile").strip(),
        "ANTHROPIC_API_KEY": (body.get("anthropic_api_key") or "").strip(),
        "ANTHROPIC_MODEL": (body.get("anthropic_model") or "claude-sonnet-4-6").strip(),
        "ANTHROPIC_BASE_URL": (
            body.get("anthropic_base_url") or "https://api.anthropic.com/v1"
        ).strip(),
        "ADMIN_TOTP_SECRET": (body.get("admin_totp_secret") or "").strip(),
        "ESP_FLASH_ADMIN_TOKEN": (
            (body.get("esp_flash_admin_token") or "").strip()
            or secrets.token_hex(24)
        ),
        "FIRMWARE_WORKSPACE_ROOT": (body.get("firmware_workspace_root") or "").strip(),
        "DEFAULT_CHAT_ID": (body.get("default_chat_id") or "").strip(),
        "FIRMWARE_DOWNLOAD_TTL_MS": str(body.get("firmware_download_ttl_ms") or "3600000").strip(),
        "FIRMWARE_BUILD_TIMEOUT_MS": str(body.get("firmware_build_timeout_ms") or "1800000").strip(),
        "ESPHOME_PLATFORMIO_HOME": (
            body.get("esphome_platformio_home") or f"{app_dir}/.cache/platformio"
        ).strip(),
        "ESPHOME_JOBS_ROOT": (body.get("esphome_jobs_root") or "/tmp/esphome-jobs").strip(),
        "ESPHOME_MAX_CONCURRENT_BUILDS": str(body.get("esphome_max_concurrent_builds") or "2").strip(),
        "ESPHOME_PUBLIC_BUILD": "0",
        "JAMMER_FIRMWARE_BIN": f"{app_dir}/public/firmware/esp8266_deauther.bin",
        "INSTALL_ESPHOME": "1" if install_esphome and platform != "termux" else "0",
        "INSTALL_ESPHOME_ANS": "y" if install_esphome and platform != "termux" else "n",
        "ESPHOME_PIN": esphome_pin,
        "DISABLE_FIRMWARE_RUNTIME": "1" if platform == "termux" else "0",
        "CONFIRM": "y",
        "NODE_ENV": "development" if platform == "termux" or mode == "local" else "production",
        "AUTH_BYPASS": "1" if platform == "termux" or mode == "local" else "0",
    }


def resolve_install_script(*, webinstall: bool = False) -> Path:
    """Установка только через setup.sh (--webinstall). bootstrap.sh — интерактив вручную."""
    if SETUP_SH.is_file():
        return SETUP_SH
    if webinstall:
        raise FileNotFoundError(
            f"Для webinstall нужен {SETUP_SH.name}; bootstrap.sh не поддерживает --webinstall",
        )
    if BOOTSTRAP_SH.is_file():
        return BOOTSTRAP_SH
    raise FileNotFoundError(f"Не найден {SETUP_SH.name} или {BOOTSTRAP_SH.name}")


def _stream_cmd(cmd: list[str], push=None, **kwargs) -> int:
    """Запускает команду, стримит вывод через push() если задан."""
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        **kwargs,
    )
    assert proc.stdout is not None
    for line in proc.stdout:
        if push:
            push(line)
        else:
            sys.stdout.write(line)
            sys.stdout.flush()
    return proc.wait()


def setup_termux_proot(push=None) -> tuple[Path, Path]:
    """
    Termux: устанавливает proot-distro Ubuntu, копирует/клонирует репозиторий внутрь.
    Возвращает (ubuntu_rootfs_path, repo_path_inside_ubuntu).
    Установку можно пропустить: TERMUX_NO_PROOT=1.
    """
    def log(msg: str) -> None:
        if push:
            push(msg + "\n")
        else:
            print(msg)

    prefix = Path(os.environ.get("PREFIX", "/data/data/com.termux/files/usr"))
    ubuntu_root = prefix / "var/lib/proot-distro/installed-rootfs/ubuntu"

    # ── 1. Базовые пакеты Termux ──────────────────────────────────
    log("▸ [Termux] pkg update + установка базовых пакетов...")
    _stream_cmd(["pkg", "update", "-y"], push=push)
    code = _stream_cmd(
        ["pkg", "install", "-y",
         "proot-distro", "python", "pip", "git", "curl", "openssl-tool"],
        push=push,
    )
    if code != 0:
        raise RuntimeError("Не удалось установить пакеты Termux (pkg install)")

    # ── 2. Ubuntu через proot-distro ──────────────────────────────
    if (ubuntu_root / "bin").is_dir():
        log("▸ [proot] Ubuntu уже установлен")
    else:
        log("▸ [proot] Скачиваем Ubuntu (proot-distro install ubuntu)...")
        code = _stream_cmd(["proot-distro", "install", "ubuntu"], push=push)
        if code != 0:
            raise RuntimeError("Не удалось установить Ubuntu через proot-distro")
        log("▸ [proot] Ubuntu установлен ✔")

    # ── 3. Репозиторий: клонируем или копируем ────────────────────
    repo_name = ROOT.name
    ubuntu_app_dir = ubuntu_root / "root" / repo_name

    try:
        remote_url = subprocess.check_output(
            ["git", "-C", str(ROOT), "remote", "get-url", "origin"],
            text=True, stderr=subprocess.DEVNULL, timeout=5,
        ).strip()
    except Exception:
        remote_url = ""

    if remote_url:
        log(f"▸ [proot] Клонируем {remote_url} в Ubuntu...")
        clone_sh = (
            "apt-get update -qq 2>/dev/null; "
            "apt-get install -y -qq git 2>/dev/null; "
            f"rm -rf /root/{repo_name}; "
            f"git clone '{remote_url}' /root/{repo_name}"
        )
        code = _stream_cmd(
            ["proot-distro", "login", "ubuntu", "--", "bash", "-c", clone_sh],
            push=push,
        )
        if code != 0:
            log("⚠  Клонирование не удалось — копируем локальную папку...")
            remote_url = ""

    if not remote_url:
        log(f"▸ [proot] Копируем {ROOT} → {ubuntu_app_dir}...")
        if ubuntu_app_dir.exists():
            shutil.rmtree(str(ubuntu_app_dir))
        shutil.copytree(str(ROOT), str(ubuntu_app_dir))
        log("▸ [proot] Репозиторий скопирован ✔")

    return ubuntu_root, Path(f"/root/{repo_name}")


def env_to_form_preset(env_data: dict[str, str]) -> dict:
    """Поля формы webinstall из .env (для предзаполнения в браузере)."""
    domain = (env_data.get("DOMAIN") or env_data.get("API_HOST") or "").strip()
    mode = (env_data.get("MODE") or "").strip().lower()
    if not mode:
        mode = "prod" if domain and domain not in ("localhost", "127.0.0.1") else "local"

    preset: dict = {
        "mode": mode,
        "domain": domain if mode == "prod" else "",
        "le_email": env_data.get("LE_EMAIL", ""),
        "api_port": env_data.get("API_PORT", "3001"),
        "db_name": env_data.get("DB_NAME", "cicada"),
        "db_user": env_data.get("DB_USER", "cicada_user"),
        "db_password": env_data.get("DB_PASSWORD", ""),
        "admin_email": env_data.get("ADMIN_EMAIL") or env_data.get("VITE_ADMIN_EMAIL", ""),
        "admin_name": env_data.get("ADMIN_NAME", "Admin"),
        "admin_password": env_data.get("ADMIN_PASSWORD", ""),
        "tg_bot_token": env_data.get("TG_BOT_TOKEN", ""),
        "tg_bot_name": env_data.get("TG_BOT_NAME") or env_data.get("VITE_TG_BOT_NAME", ""),
        "resend_api_key": env_data.get("RESEND_API_KEY", ""),
        "email_from": env_data.get("EMAIL_FROM", ""),
        "cryptobot_token": env_data.get("CRYPTOBOT_TOKEN", ""),
        "google_client_id": env_data.get("GOOGLE_CLIENT_ID", ""),
        "google_client_secret": env_data.get("GOOGLE_CLIENT_SECRET", ""),
        "google_callback_url": env_data.get("GOOGLE_CALLBACK_URL", ""),
        "ai_provider": env_data.get("AI_PROVIDER", ""),
        "groq_token": env_data.get("GROQ_TOKEN", ""),
        "groq_token_2": env_data.get("GROQ_TOKEN_2", ""),
        "groq_token_3": env_data.get("GROQ_TOKEN_3", ""),
        "groq_model": env_data.get("GROQ_MODEL", "llama-3.3-70b-versatile"),
        "ollama_url": env_data.get("OLLAMA_URL", "https://api.groq.com/openai"),
        "ollama_model": env_data.get("OLLAMA_MODEL", "llama-3.3-70b-versatile"),
        "anthropic_api_key": env_data.get("ANTHROPIC_API_KEY", ""),
        "anthropic_model": env_data.get("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
        "anthropic_base_url": env_data.get("ANTHROPIC_BASE_URL", "https://api.anthropic.com/v1"),
        "admin_totp_secret": env_data.get("ADMIN_TOTP_SECRET", ""),
        "default_chat_id": (env_data.get("DEFAULT_CHAT_ID") or "").lstrip("#").strip(),
        "jwt_expires_sec": env_data.get("JWT_EXPIRES_SEC", "604800"),
        "esphome_pin": env_data.get("ESPHOME_PIN", ""),
        "install_esphome": env_data.get("INSTALL_ESPHOME", "1") in ("1", "y", "yes", "true"),
    }
    if env_data.get("ADMIN_KEY"):
        preset["auto_admin_key"] = False
        preset["admin_key"] = env_data["ADMIN_KEY"]
    if env_data.get("JWT_SECRET"):
        preset["auto_jwt"] = False
        preset["jwt_secret"] = env_data["JWT_SECRET"]
    if env_data.get("AUTH_BYPASS") in ("1", "true", "yes", "on"):
        preset["auth_bypass"] = True
        preset["admin_password"] = ""
    return preset


INDEX_HTML = WEBINSTALL_DIR / "index.html"


def port_is_open(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=1):
            return True
    except OSError:
        return False


def describe_port_owner(port: int) -> str | None:
    for cmd in (
        ["ss", "-tlnp", f"sport = :{port}"],
        ["lsof", "-i", f":{port}"],
    ):
        if not shutil.which(cmd[0]):
            continue
        try:
            out = subprocess.check_output(cmd, text=True, timeout=5, stderr=subprocess.DEVNULL)
            for line in out.splitlines():
                if f":{port}" in line:
                    return line.strip()[:200]
        except (subprocess.SubprocessError, OSError):
            continue
    return None


def try_free_port(port: int) -> bool:
    """Освободить порт (только root). WEBINSTALL_FREE_PORT=1 или по умолчанию на VPS."""
    if os.environ.get("WEBINSTALL_NO_FREE_PORT"):
        return False
    if detect_platform() != "vps" or os.geteuid() != 0:
        return False
    if os.environ.get("WEBINSTALL_FREE_PORT", "1").strip().lower() in ("0", "false", "no"):
        return False
    fuser = shutil.which("fuser")
    if not fuser:
        return False
    if not port_is_open("127.0.0.1", port):
        return True
    subprocess.run([fuser, "-k", f"{port}/tcp"], capture_output=True, timeout=10)
    time.sleep(0.4)
    return not port_is_open("127.0.0.1", port)


def create_webinstall_server(host: str, start_port: int) -> tuple[ThreadingHTTPServer, int]:
    """Bind HTTP server; if start_port is busy, try the next ports (up to +20)."""
    last_err: OSError | None = None
    for offset in range(21):
        port = start_port + offset
        try:
            server = ThreadingHTTPServer((host, port), Handler)
            server.allow_reuse_address = True
            return server, port
        except OSError as exc:
            if exc.errno not in _ADDR_IN_USE:
                raise
            last_err = exc
    msg = (
        f"Не удалось занять порт {start_port}–{start_port + 20} на {host}.\n"
        f"  Освободите порт:  fuser -k {start_port}/tcp\n"
        f"  или укажите другой:  WEBINSTALL_PORT=7701 python3 webinstall.py"
    )
    raise SystemExit(msg) from last_err


def guess_public_ipv4() -> str | None:
    """Первый не-loopback IPv4 на сервере (для VPS)."""
    try:
        out = subprocess.check_output(
            ["hostname", "-I"],
            text=True,
            timeout=3,
            stderr=subprocess.DEVNULL,
        ).strip()
        for token in out.split():
            if "." in token and not token.startswith("127."):
                return token
    except (subprocess.SubprocessError, FileNotFoundError, OSError):
        pass
    return None


def resolve_public_host() -> str | None:
    """Домен или IP для ссылки с ПК (не 0.0.0.0 из API_HOST)."""
    env_path = ROOT / ".env"
    if env_path.is_file():
        env_data = parse_env_file(env_path)
        domain = (env_data.get("DOMAIN") or "").strip()
        if domain.lower() not in _LOOPBACK_HOSTS:
            return domain
        app_url = (env_data.get("APP_URL") or "").strip()
        if app_url:
            try:
                host = urlparse(app_url).hostname
                if host and host.lower() not in _LOOPBACK_HOSTS:
                    return host
            except ValueError:
                pass
        api_host = (env_data.get("API_HOST") or "").strip()
        if api_host.lower() not in _LOOPBACK_HOSTS:
            return api_host
    return guess_public_ipv4()


def public_api_base(port: int | None = None) -> str:
    """
    Базовый URL API webinstall (без завершающего /).
    WSL/Termux → 127.0.0.1; VPS → домен/IP из .env или сети.
    """
    p = PORT if port is None else port
    custom = os.environ.get("WEBINSTALL_PUBLIC_URL", "").strip().rstrip("/")
    if custom:
        # Порт webinstall — только plain HTTP; https:// даёт TLS ClientHello и 400 в логах
        if custom.lower().startswith("https://"):
            custom = "http://" + custom[8:]
        return custom

    plat = detect_platform()
    if plat in ("wsl", "termux"):
        return f"http://127.0.0.1:{p}"

    host = resolve_public_host()
    if host:
        return f"http://{host}:{p}"

    if HOST not in ("0.0.0.0", "::", ""):
        return f"http://{HOST}:{p}"
    return f"http://127.0.0.1:{p}"


def local_browser_url(port: int | None = None) -> str:
    """URL для браузера на той же машине (WSL → Windows localhost)."""
    p = PORT if port is None else port
    return f"http://127.0.0.1:{p}/"


def browser_url(port: int | None = None) -> str:
    return f"{public_api_base(port)}/"


def _run_quiet(cmd: list[str], timeout: float = 20) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=timeout,
        errors="replace",
    )


def _ufw_prefix() -> list[str] | None:
    ufw = shutil.which("ufw")
    if not ufw:
        return None
    try:
        if os.geteuid() == 0:
            return [ufw]
        sudo = shutil.which("sudo")
        if sudo:
            return [sudo, "-n", ufw]
    except AttributeError:
        pass
    return None


def ensure_firewall_port(port: int) -> str | None:
    """VPS/WSL: ufw allow PORT/tcp (если доступен ufw и root/sudo -n)."""
    if os.environ.get("WEBINSTALL_SKIP_FIREWALL"):
        return None
    if detect_platform() not in ("vps", "wsl"):
        return None
    prefix = _ufw_prefix()
    if not prefix:
        return None
    rule = f"{port}/tcp"
    try:
        st = _run_quiet([*prefix, "status"], timeout=10)
        combined = (st.stdout or "") + (st.stderr or "")
        _run_quiet([*prefix, "allow", rule], timeout=15)
        inactive = "inactive" in combined.lower()
        if inactive and os.environ.get("WEBINSTALL_UFW_ENABLE", "1").strip().lower() not in (
            "0",
            "false",
            "no",
        ):
            _run_quiet([*prefix, "--force", "enable"], timeout=20)
            _run_quiet([*prefix, "reload"], timeout=15)
            st2 = _run_quiet([*prefix, "status"], timeout=10)
            if "inactive" not in ((st2.stdout or "") + (st2.stderr or "")).lower():
                return f"файрвол: ufw включён, порт {port}/tcp открыт"
        if not inactive:
            _run_quiet([*prefix, "reload"], timeout=15)
            return f"файрвол: порт {port}/tcp открыт (ufw)"
        return f"ufw: правило {rule} добавлено (включите: ufw enable && ufw reload)"
    except (subprocess.SubprocessError, OSError, TimeoutError) as exc:
        return f"ufw: не удалось открыть порт {port} ({exc})"


def prepare_webinstall_network(port: int, page_url: str) -> None:
    """Автонастройка доступа: firewall, подсказки, проверка локального HTTP."""
    plat = detect_platform()
    fw = ensure_firewall_port(port)
    if fw:
        if fw.startswith("файрвол"):
            print(f"  ✓ {fw}")
        else:
            print(f"  ▲ {fw}")

    if verify_local_server(port):
        print(f"  ✓ HTTP OK на 127.0.0.1:{port}")
    else:
        print(f"  ⚠ Нет ответа на 127.0.0.1:{port} — подождите секунду или проверьте логи")

    if plat == "vps" and is_vps_headless():
        print()
        print_vps_access_hints(port, page_url)
        host = resolve_public_host()
        if host:
            print(f"  Откройте на ПК:  http://{host}:{port}/  (не https)")
    elif plat in ("wsl", "termux") or sys.platform == "win32":
        print(f"  Локальный браузер:  {local_browser_url(port)}")


def is_vps_headless() -> bool:
    """VPS по SSH без графического окружения — webbrowser.open бесполезен."""
    if detect_platform() != "vps":
        return False
    if os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY"):
        return False
    return True


def verify_local_server(port: int) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=3):
            return True
    except OSError:
        return False


def print_vps_access_hints(port: int, page_url: str) -> None:
    print("  VPS (SSH): откройте ссылку на своём ПК (Chrome/Edge).")
    print(f"  Страница:  {page_url}")
    host = resolve_public_host() or "IP_СЕРВЕРА"
    print("  Если с ПК не открывается:")
    print(f"    · SSH-туннель на компьютере:  ssh -L {port}:127.0.0.1:{port} root@{host}")
    print(f"      затем в браузере:  http://127.0.0.1:{port}/")
    print("    · Панель хостинга: разрешите входящий TCP на этот порт")
    print(f"    · На VPS:  curl -sI http://127.0.0.1:{port}/ | head -1")
    print("  Без UI:  python3 webinstall.py --direct")


def index_html_windows_path() -> str | None:
    """Путь к index.html в формате Windows (C:\\Users\\...)."""
    if sys.platform == "win32":
        return str(INDEX_HTML.resolve())
    try:
        return subprocess.check_output(
            ["wslpath", "-w", str(INDEX_HTML.resolve())],
            text=True,
            timeout=5,
        ).strip()
    except (subprocess.SubprocessError, FileNotFoundError, OSError):
        return None


def windows_path_to_file_uri(win_path: str) -> str:
    """C:\\Users\\... → file:///C:/Users/... (pathlib в Linux не понимает диск C:)."""
    p = win_path.strip().replace("\\", "/")
    if len(p) >= 2 and p[1] == ":":
        return "file:///" + p
    if p.startswith("//"):
        return "file:" + p
    raise ValueError(f"не Windows-путь: {win_path!r}")


def install_page_target(port: int | None = None) -> tuple[str, str]:
    """
    (url для консоли, подпись).
    VPS → публичный URL; WSL/Termux/Windows → 127.0.0.1 (прокси WSL).
    """
    p = PORT if port is None else port
    plat = detect_platform()

    if plat == "vps":
        page = browser_url(p)
        return page, page

    local = local_browser_url(p)
    return local, local


def open_install_page(port: int | None = None) -> None:
    if os.environ.get("WEBINSTALL_NO_BROWSER"):
        return
    p = PORT if port is None else port
    plat = detect_platform()
    if is_vps_headless():
        return

    # Всегда localhost для WSL/Windows/десктоп — WSL пробрасывает порт в Windows
    open_url = local_browser_url(p)
    if plat == "vps":
        open_url = browser_url(p)

    try:
        if plat == "wsl" or sys.platform == "win32":
            subprocess.Popen(
                ["cmd.exe", "/c", "start", "", open_url],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            print(f"  ✓ Браузер: {open_url}")
            return
        import webbrowser

        if webbrowser.open(open_url):
            print(f"  ✓ Браузер: {open_url}")
    except OSError:
        print(f"  ▲ Откройте вручную: {open_url}")


def run_install_job(job_id: str, env_path: Path) -> None:
    job = _jobs[job_id]
    q: queue.Queue = job["queue"]

    def push(line: str) -> None:
        q.put(line)

    try:
        install_script = resolve_install_script(webinstall=True)
    except FileNotFoundError as e:
        push(f"ERROR: {e}\n")
        job["status"] = "failed"
        q.put(None)
        return

    bash = shutil.which("bash") or "/bin/bash"

    # ── Termux: запуск через proot-distro Ubuntu ──────────────────
    if detect_platform() == "termux" and not os.environ.get("TERMUX_NO_PROOT"):
        try:
            ubuntu_root, ubuntu_app = setup_termux_proot(push=push)
            # Копируем env-файл внутрь Ubuntu
            ubuntu_env_file = ubuntu_root / "root" / "cicada-webinstall.env"
            shutil.copy2(str(env_path), str(ubuntu_env_file))
            ubuntu_script = str(ubuntu_app / "setup.sh")
            ubuntu_env = "/root/cicada-webinstall.env"
            cmd = [
                "proot-distro", "login", "ubuntu", "--",
                bash, ubuntu_script, "--webinstall", ubuntu_env,
            ]
            push(f"▸ Запуск внутри Ubuntu proot\n$ {' '.join(cmd)}\n\n")
        except Exception as exc:
            push(f"⚠  proot-distro недоступен ({exc}) — запуск напрямую в Termux\n\n")
            cmd = [bash, str(install_script), "--webinstall", str(env_path)]
            push(f"$ {' '.join(cmd)}\n\n")
    else:
        cmd = [bash, str(install_script), "--webinstall", str(env_path)]
        push(f"$ {' '.join(cmd)}\n\n")

    try:
        proc = subprocess.Popen(
            cmd,
            cwd=str(ROOT),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env={**os.environ, "TERM": "dumb", "COLUMNS": "120"},
        )
        job["pid"] = proc.pid
        assert proc.stdout is not None
        for line in proc.stdout:
            push(line)
        code = proc.wait()
        if code == 0:
            push("\n✔ Установка завершена успешно\n")
            job["status"] = "done"
        else:
            push(f"\n✖ Код выхода: {code}\n")
            job["status"] = "failed"
    except Exception as e:
        push(f"\n✖ Ошибка запуска: {e}\n")
        job["status"] = "failed"
    finally:
        q.put(None)


def run_install_direct(env_path: Path) -> int:
    """Запускает установку напрямую из .env файла (вывод в консоль)."""
    install_script = resolve_install_script(webinstall=True)

    if not install_script.is_file():
        print(f"Ошибка: не найден {install_script}", file=sys.stderr)
        return 1

    bash = shutil.which("bash") or "/bin/bash"

    # ── Termux: запуск через proot-distro Ubuntu ──────────────────
    if detect_platform() == "termux" and not os.environ.get("TERMUX_NO_PROOT"):
        try:
            ubuntu_root, ubuntu_app = setup_termux_proot()
            ubuntu_env_file = ubuntu_root / "root" / "cicada-webinstall.env"
            shutil.copy2(str(env_path), str(ubuntu_env_file))
            ubuntu_script = str(ubuntu_app / "setup.sh")
            ubuntu_env = "/root/cicada-webinstall.env"
            cmd = [
                "proot-distro", "login", "ubuntu", "--",
                bash, ubuntu_script, "--webinstall", ubuntu_env,
            ]
            print(f"▸ Запуск внутри Ubuntu proot\n$ {' '.join(cmd)}\n")
        except Exception as exc:
            print(f"⚠  proot-distro недоступен ({exc}) — запуск напрямую в Termux\n")
            cmd = [bash, str(install_script), "--webinstall", str(env_path)]
            print(f"$ {' '.join(cmd)}\n")
    else:
        cmd = [bash, str(install_script), "--webinstall", str(env_path)]
        print(f"$ {' '.join(cmd)}\n")

    try:
        proc = subprocess.Popen(
            cmd,
            cwd=str(ROOT),
            stdout=sys.stdout,
            stderr=sys.stderr,
            text=True,
            env={**os.environ, "TERM": "dumb", "COLUMNS": "120"},
        )
        code = proc.wait()
        if code == 0:
            print("\n✔ Установка завершена успешно")
        else:
            print(f"\n✖ Код выхода: {code}")
        return code
    except Exception as e:
        print(f"\n✖ Ошибка запуска: {e}", file=sys.stderr)
        return 1


def sse_format(data: str, event: str | None = None) -> bytes:
    lines = []
    if event:
        lines.append(f"event: {event}")
    for part in data.split("\n"):
        lines.append(f"data: {part}")
    lines.append("")
    return ("\n".join(lines) + "\n").encode("utf-8")


_sysmon_cpu_lock = threading.Lock()
_sysmon_cpu_prev: dict[str, tuple[int, int]] | None = None
_sysmon_cpu_prev_at = 0.0


def _mb(n: int | float) -> float:
    return round(float(n) / (1024 * 1024), 2)


def _cpu_line_usage(prev: tuple[int, int] | None, idle: int, total: int) -> float:
    if prev is None:
        return 0.0
    idle_d = idle - prev[0]
    total_d = total - prev[1]
    if total_d <= 0:
        return 0.0
    return max(0.0, min(100.0, 100.0 * (1.0 - idle_d / total_d)))


def _read_proc_cpu() -> tuple[tuple[int, int], list[tuple[int, int]]]:
    idle_total = 0
    sum_total = 0
    cores: list[tuple[int, int]] = []
    with open("/proc/stat", encoding="utf-8") as fh:
        for line in fh:
            if not line.startswith("cpu"):
                break
            parts = line.split()
            if line.startswith("cpu ") or line == "cpu\n":
                nums = [int(x) for x in parts[1:]]
                idle_total = nums[3] + (nums[4] if len(nums) > 4 else 0)
                sum_total = sum(nums)
                continue
            if len(parts) < 5:
                continue
            nums = [int(x) for x in parts[1:]]
            idle = nums[3] + (nums[4] if len(nums) > 4 else 0)
            cores.append((idle, sum(nums)))
    return (idle_total, sum_total), cores


def _read_proc_mem_kb() -> dict[str, int]:
    data: dict[str, int] = {}
    with open("/proc/meminfo", encoding="utf-8") as fh:
        for line in fh:
            key, rest = line.split(":", 1)
            data[key.strip()] = int(rest.strip().split()[0])
    return data


def _cpu_model_unix() -> str:
    try:
        with open("/proc/cpuinfo", encoding="utf-8") as fh:
            for line in fh:
                if line.lower().startswith("model name"):
                    return line.split(":", 1)[1].strip()
    except OSError:
        pass
    return platform.processor() or "CPU"


def _metrics_unix() -> dict:
    global _sysmon_cpu_prev, _sysmon_cpu_prev_at
    now = time.time()
    agg, core_lines = _read_proc_cpu()
    with _sysmon_cpu_lock:
        prev = _sysmon_cpu_prev
        usage = _cpu_line_usage(prev["agg"] if prev else None, agg[0], agg[1])
        per_core = [
            {"core": i, "load": round(_cpu_line_usage(
                prev["cores"][i] if prev and i < len(prev["cores"]) else None,
                c[0], c[1],
            ), 1)}
            for i, c in enumerate(core_lines)
        ]
        _sysmon_cpu_prev = {"agg": agg, "cores": core_lines}
        _sysmon_cpu_prev_at = now

    mem = _read_proc_mem_kb()
    total_mb = _mb(mem.get("MemTotal", 0) * 1024)
    free_kb = mem.get("MemAvailable", mem.get("MemFree", 0))
    used_mb = max(0.0, total_mb - _mb(free_kb * 1024))
    swap_total_mb = _mb(mem.get("SwapTotal", 0) * 1024)
    swap_free_mb = _mb(mem.get("SwapFree", 0) * 1024)
    swap_used_mb = max(0.0, swap_total_mb - swap_free_mb)

    uptime_s = 0.0
    load1 = load5 = load15 = 0.0
    try:
        uptime_s = float(open("/proc/uptime", encoding="utf-8").read().split()[0])
        load1, load5, load15 = map(float, open("/proc/loadavg", encoding="utf-8").read().split()[:3])
    except OSError:
        pass

    plat = detect_platform()
    plat_labels = {"vps": "VPS / Linux", "wsl": "WSL", "termux": "Termux"}
    is_root = False
    try:
        is_root = os.geteuid() == 0
    except AttributeError:
        pass

    return {
        "hostname": socket.gethostname(),
        "platform": plat,
        "platformLabel": plat_labels.get(plat, platform.platform()),
        "isRoot": is_root,
        "canSetupSwap": plat != "termux" and sys.platform != "win32",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(now)),
        "uptime": uptime_s,
        "cpu": {
            "usagePercent": round(usage, 1),
            "model": _cpu_model_unix(),
            "loadAvg1": load1,
            "loadAvg5": load5,
            "loadAvg15": load15,
            "perCore": per_core or [{"core": 0, "load": round(usage, 1)}],
        },
        "memory": {
            "totalMb": total_mb,
            "usedMb": used_mb,
            "freeMb": max(0.0, total_mb - used_mb),
            "usedPercent": round((used_mb / total_mb * 100) if total_mb else 0, 1),
        },
        "swap": {
            "totalMb": swap_total_mb,
            "usedMb": swap_used_mb,
            "freeMb": swap_free_mb,
            "usedPercent": round((swap_used_mb / swap_total_mb * 100) if swap_total_mb else 0, 1),
        },
    }


def _metrics_windows() -> dict:
    global _sysmon_cpu_prev, _sysmon_cpu_prev_at
    import ctypes
    from ctypes import wintypes

    class FILETIME(ctypes.Structure):
        _fields_ = [("dwLowDateTime", wintypes.DWORD), ("dwHighDateTime", wintypes.DWORD)]

    class MEMORYSTATUSEX(ctypes.Structure):
        _fields_ = [
            ("dwLength", wintypes.DWORD),
            ("dwMemoryLoad", wintypes.DWORD),
            ("ullTotalPhys", ctypes.c_ulonglong),
            ("ullAvailPhys", ctypes.c_ulonglong),
            ("ullTotalPageFile", ctypes.c_ulonglong),
            ("ullAvailPageFile", ctypes.c_ulonglong),
            ("ullTotalVirtual", ctypes.c_ulonglong),
            ("ullAvailVirtual", ctypes.c_ulonglong),
            ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
        ]

    kernel32 = ctypes.windll.kernel32
    idle_ft = FILETIME()
    kernel_ft = FILETIME()
    user_ft = FILETIME()
    if not kernel32.GetSystemTimes(
        ctypes.byref(idle_ft), ctypes.byref(kernel_ft), ctypes.byref(user_ft)
    ):
        raise OSError("GetSystemTimes failed")

    def ft_int(ft: FILETIME) -> int:
        return (ft.dwHighDateTime << 32) + ft.dwLowDateTime

    idle = ft_int(idle_ft)
    total = idle + ft_int(kernel_ft) + ft_int(user_ft)
    now = time.time()
    usage = 0.0
    with _sysmon_cpu_lock:
        prev = _sysmon_cpu_prev
        if prev is None:
            _sysmon_cpu_prev = (idle, total)
            _sysmon_cpu_prev_at = now
            time.sleep(0.2)
            if kernel32.GetSystemTimes(
                ctypes.byref(idle_ft), ctypes.byref(kernel_ft), ctypes.byref(user_ft)
            ):
                idle = ft_int(idle_ft)
                total = idle + ft_int(kernel_ft) + ft_int(user_ft)
        else:
            usage = _cpu_line_usage(prev, idle, total)
        _sysmon_cpu_prev = (idle, total)
        _sysmon_cpu_prev_at = now

    mem = MEMORYSTATUSEX()
    mem.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
    if not kernel32.GlobalMemoryStatusEx(ctypes.byref(mem)):
        raise OSError("GlobalMemoryStatusEx failed")

    total_mb = _mb(mem.ullTotalPhys)
    free_mb = _mb(mem.ullAvailPhys)
    used_mb = max(0.0, total_mb - free_mb)
    swap_total_mb = _mb(mem.ullTotalPageFile)
    swap_free_mb = _mb(mem.ullAvailPageFile)
    swap_used_mb = max(0.0, swap_total_mb - swap_free_mb)
    cores = os.cpu_count() or 1
    load = usage / 100.0 * cores

    uptime_s = float(kernel32.GetTickCount64()) / 1000.0

    plat = detect_platform()
    plat_labels = {"vps": "VPS / Linux", "wsl": "WSL", "termux": "Termux"}

    return {
        "hostname": socket.gethostname(),
        "platform": plat,
        "platformLabel": plat_labels.get(plat, "Windows"),
        "isRoot": False,
        "canSetupSwap": False,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(now)),
        "uptime": uptime_s,
        "cpu": {
            "usagePercent": round(usage, 1),
            "model": platform.processor() or "Windows CPU",
            "loadAvg1": round(load, 2),
            "loadAvg5": round(load, 2),
            "loadAvg15": round(load, 2),
            "perCore": [{"core": i, "load": round(usage, 1)} for i in range(cores)],
        },
        "memory": {
            "totalMb": total_mb,
            "usedMb": used_mb,
            "freeMb": free_mb,
            "usedPercent": round(mem.dwMemoryLoad, 1),
        },
        "swap": {
            "totalMb": swap_total_mb,
            "usedMb": swap_used_mb,
            "freeMb": swap_free_mb,
            "usedPercent": round((swap_used_mb / swap_total_mb * 100) if swap_total_mb else 0, 1),
        },
    }


def collect_system_metrics() -> dict:
    if sys.platform == "win32":
        return _metrics_windows()
    if sys.platform.startswith("linux") or sys.platform == "darwin":
        return _metrics_unix()
    return _metrics_unix()


def _processes_unix() -> dict:
    try:
        out = subprocess.check_output(
            ["ps", "-eo", "pid,user,stat,pcpu,rss,comm", "--no-headers"],
            text=True,
            timeout=8,
            errors="replace",
        )
    except (subprocess.SubprocessError, FileNotFoundError):
        return {"total": 0, "processes": []}

    rows: list[dict] = []
    for line in out.splitlines():
        parts = line.split(None, 5)
        if len(parts) < 6:
            continue
        pid_s, user, status, cpu_s, rss_s, comm = parts
        try:
            pid = int(pid_s)
            cpu = float(cpu_s)
            mem_mb = int(rss_s) / 1024.0
        except ValueError:
            continue
        name = os.path.basename(comm)
        rows.append({
            "pid": pid,
            "name": name,
            "user": user,
            "status": status,
            "command": comm,
            "cpu": cpu,
            "memMb": mem_mb,
        })
    rows.sort(key=lambda r: r["cpu"], reverse=True)
    return {"total": len(rows), "processes": rows[:80]}


def _processes_windows() -> dict:
    script = (
        "Get-CimInstance Win32_PerfFormattedData_PerfProc_Process | "
        "Where-Object { $_.IDProcess -gt 0 -and $_.Name -ne '_Total' -and $_.Name -ne 'Idle' } | "
        "Sort-Object PercentProcessorTime -Descending | "
        "Select-Object -First 80 @{N='pid';E={[int]$_.IDProcess}},"
        "@{N='name';E={$_.Name}},"
        "@{N='cpu';E={[double]$_.PercentProcessorTime}},"
        "@{N='memMb';E={[math]::Round($_.WorkingSet/1MB,1)}} | "
        "ConvertTo-Json -Compress"
    )
    try:
        out = subprocess.check_output(
            ["powershell", "-NoProfile", "-Command", script],
            text=True,
            timeout=12,
            errors="replace",
        ).strip()
    except (subprocess.SubprocessError, FileNotFoundError):
        return {"total": 0, "processes": []}

    if not out:
        return {"total": 0, "processes": []}
    try:
        data = json.loads(out)
    except json.JSONDecodeError:
        return {"total": 0, "processes": []}
    if isinstance(data, dict):
        data = [data]

    rows: list[dict] = []
    for item in data:
        name = str(item.get("name", ""))
        if "#" in name:
            name = name.split("#", 1)[0]
        rows.append({
            "pid": int(item.get("pid", 0)),
            "name": name,
            "user": "-",
            "status": "running",
            "command": name,
            "cpu": float(item.get("cpu", 0)),
            "memMb": float(item.get("memMb", 0)),
        })
    return {"total": len(rows), "processes": rows}


def collect_system_processes() -> dict:
    if sys.platform == "win32":
        return _processes_windows()
    return _processes_unix()


def load_html() -> bytes:
    path = WEBINSTALL_DIR / "index.html"
    if not path.is_file():
        raise FileNotFoundError(f"Нет {path}")
    return path.read_bytes()


FILES_ROOT = ROOT.resolve()
FILES_MAX_READ = 512 * 1024
FILES_SKIP_NAMES = frozenset({".git", "node_modules", "__pycache__", ".venv-bot", ".venv-esphome"})
FILES_BLOCK_NAMES = frozenset({".env", ".env.local", ".env.production"})


def safe_files_path(rel: str) -> Path:
    rel = (rel or "").strip().replace("\\", "/").lstrip("/")
    parts = [p for p in rel.split("/") if p and p != "."]
    if ".." in parts:
        raise ValueError("недопустимый путь")
    target = (FILES_ROOT / "/".join(parts)).resolve()
    root = str(FILES_ROOT)
    resolved = str(target)
    if resolved != root and not resolved.startswith(root + os.sep):
        raise ValueError("путь вне каталога приложения")
    return target


def list_files_dir(rel: str) -> dict:
    target = safe_files_path(rel)
    if not target.is_dir():
        raise ValueError("не каталог")
    parent = ""
    if target != FILES_ROOT:
        parent = str(target.parent.relative_to(FILES_ROOT)).replace("\\", "/")
    entries: list[dict] = []
    try:
        children = sorted(target.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower()))
    except OSError as exc:
        raise ValueError(str(exc)) from exc
    for entry in children:
        name = entry.name
        if name in FILES_SKIP_NAMES:
            continue
        if name.startswith(".") and name not in (".gitkeep",):
            continue
        if name in FILES_BLOCK_NAMES or name.lower().endswith(".env"):
            continue
        try:
            st = entry.stat()
        except OSError:
            continue
        entries.append({
            "name": name,
            "dir": entry.is_dir(),
            "size": st.st_size if entry.is_file() else 0,
            "mtime": int(st.st_mtime),
        })
    rel_path = "" if target == FILES_ROOT else str(target.relative_to(FILES_ROOT)).replace("\\", "/")
    return {
        "path": rel_path,
        "parent": parent,
        "root": str(FILES_ROOT),
        "entries": entries,
    }


def read_text_file(rel: str) -> dict:
    target = safe_files_path(rel)
    if not target.is_file():
        raise ValueError("не файл")
    size = target.stat().st_size
    if size > FILES_MAX_READ:
        raise ValueError(f"файл слишком большой (>{FILES_MAX_READ // 1024} КБ)")
    raw = target.read_bytes()
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        raise ValueError("не текстовый файл (UTF-8)")
    return {"path": rel, "size": size, "content": text}


def setup_swap(size_gb: float, swap_path: str = "/swapfile") -> dict:
    if sys.platform == "win32":
        raise ValueError("swap доступен только на Linux")
    try:
        if os.geteuid() != 0:
            raise ValueError("нужен root: sudo python3 webinstall.py")
    except AttributeError:
        raise ValueError("swap доступен только на Linux") from None

    size_gb = max(0.5, min(64.0, float(size_gb)))
    swap_path = (swap_path or "/swapfile").strip()
    if not swap_path.startswith("/") or ".." in swap_path:
        raise ValueError("некорректный путь swap")

    try:
        swaps = Path("/proc/swaps").read_text(encoding="utf-8", errors="ignore")
        if swap_path in swaps:
            return {"ok": True, "message": "swap уже подключён", "path": swap_path}
    except OSError:
        pass

    size_arg = f"{int(size_gb)}G"
    path_obj = Path(swap_path)
    if path_obj.exists():
        raise ValueError(f"файл уже существует: {swap_path}")

    created = False
    try:
        subprocess.run(
            ["fallocate", "-l", size_arg, swap_path],
            check=True,
            capture_output=True,
            timeout=120,
        )
        created = True
    except (subprocess.CalledProcessError, FileNotFoundError, OSError):
        subprocess.run(
            ["dd", "if=/dev/zero", f"of={swap_path}", f"bs=1M", f"count={int(size_gb * 1024)}"],
            check=True,
            capture_output=True,
            timeout=600,
        )
        created = True

    os.chmod(swap_path, 0o600)
    subprocess.run(["mkswap", swap_path], check=True, capture_output=True, timeout=60)
    subprocess.run(["swapon", swap_path], check=True, capture_output=True, timeout=30)

    fstab = Path("/etc/fstab")
    line = f"{swap_path} none swap sw 0 0\n"
    if fstab.is_file():
        content = fstab.read_text(encoding="utf-8", errors="ignore")
        if swap_path not in content:
            with fstab.open("a", encoding="utf-8") as fh:
                fh.write(line)
    elif created:
        pass

    return {
        "ok": True,
        "path": swap_path,
        "sizeGb": size_gb,
        "message": f"swap {size_gb} ГБ создан и включён",
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "CicadaWebInstall/1.0"

    def _looks_like_tls_client_hello(self, data: bytes) -> bool:
        # TLS record: 0x16 0x03 0x0x (Handshake)
        return len(data) >= 3 and data[0] == 0x16 and data[1] == 0x03

    def _send_tls_on_http_hint(self) -> None:
        # parse_request() не вызывался — log_request() требует requestline (Python 3.14+)
        self.requestline = _TLS_HINT_REQUESTLINE
        self.command = "-"
        self.request_version = "HTTP/1.0"
        host = resolve_public_host() or "127.0.0.1"
        body = (
            f"Webinstall на этом порту — только HTTP (без SSL).\r\n\r\n"
            f"Откройте в браузере:\r\n  http://{host}:{PORT}/\r\n\r\n"
            f"Не используйте https:// на порту {PORT}.\r\n"
            f"Сайт с SSL: https://{host}/ (nginx, порт 443).\r\n"
        ).encode("utf-8")
        try:
            self.send_response(400)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(body)
        except OSError:
            pass

    def handle_one_request(self) -> None:
        self.close_connection = True
        self.raw_requestline = self.rfile.readline(65537)
        if len(self.raw_requestline) > 65536:
            self.requestline = ""
            self.request_version = ""
            self.command = ""
            self.send_error(414)
            return
        if not self.raw_requestline:
            return
        if self._looks_like_tls_client_hello(self.raw_requestline):
            self._send_tls_on_http_hint()
            return
        if not self.parse_request():
            return
        mname = "do_" + self.command
        if not hasattr(self, mname):
            self.send_error(501)
            return
        method = getattr(self, mname)
        method()
        self.wfile.flush()

    def log_request(self, code: str = "-", size: str = "-") -> None:
        if getattr(self, "requestline", "") == _TLS_HINT_REQUESTLINE:
            ip = self.client_address[0]
            now = time.time()
            last = _TLS_LOG_LAST.get(ip, 0.0)
            if now - last < _TLS_LOG_INTERVAL_SEC:
                return
            _TLS_LOG_LAST[ip] = now
            host = resolve_public_host() or "127.0.0.1"
            sys.stderr.write(
                "%s - HTTPS на порт %s — откройте http://%s:%s/ (повторы с этого IP скрыты %d с)\n"
                % (ip, PORT, host, PORT, _TLS_LOG_INTERVAL_SEC)
            )
            return
        super().log_request(code, size)

    def log_message(self, fmt: str, *args) -> None:
        msg = (fmt % args) if args else fmt
        if _TLS_HINT_REQUESTLINE in msg:
            return
        if "Bad request version" in msg or "Bad HTTP" in msg:
            ip = self.client_address[0]
            now = time.time()
            last = _TLS_LOG_LAST.get(ip, 0.0)
            if now - last < _TLS_LOG_INTERVAL_SEC:
                return
            _TLS_LOG_LAST[ip] = now
            host = resolve_public_host() or "127.0.0.1"
            sys.stderr.write(
                "%s - HTTPS/TLS на HTTP-порт %s — откройте http://%s:%s/\n"
                % (ip, PORT, host, PORT)
            )
            return
        sys.stderr.write("%s - %s\n" % (self.address_string(), msg))

    def end_headers(self) -> None:
        # file:// → http://127.0.0.1 (открытие index.html с диска Windows)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.end_headers()

    def _json(self, code: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8"))

    def do_GET(self) -> None:
        path = urlparse(self.path).path

        if path in ("/", "/index.html"):
            body = load_html()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if path == "/api/info":
            plat = detect_platform()
            bound = PORT
            api_base = public_api_base(bound)
            payload: dict = {
                "platform": plat,
                "display_platform": PLATFORM_LABELS.get(plat, plat),
                "termux": plat == "termux",
                "root": os.geteuid() == 0 if hasattr(os, "geteuid") else False,
                "port": bound,
                "app_dir": str(ROOT),
                "url": browser_url(bound),
                "api_base": api_base,
                "local_url": local_browser_url(bound).rstrip("/"),
            }
            env_path = ROOT / ".env"
            if env_path.is_file():
                payload["has_env"] = True
                payload["preset"] = env_to_form_preset(process_env_file(env_path))
            self._json(200, payload)
            return

        if path == "/api/system/metrics":
            try:
                self._json(200, collect_system_metrics())
            except Exception as exc:
                self._json(500, {"error": str(exc)})
            return

        if path == "/api/system/processes":
            try:
                self._json(200, collect_system_processes())
            except Exception as exc:
                self._json(500, {"error": str(exc)})
            return

        if path == "/api/files/list":
            qs = parse_qs(urlparse(self.path).query)
            rel = (qs.get("path") or [""])[0]
            try:
                self._json(200, list_files_dir(rel))
            except ValueError as exc:
                self._json(400, {"error": str(exc)})
            except Exception as exc:
                self._json(500, {"error": str(exc)})
            return

        if path == "/api/files/read":
            qs = parse_qs(urlparse(self.path).query)
            rel = (qs.get("path") or [""])[0]
            if not rel:
                self._json(400, {"error": "path обязателен"})
                return
            try:
                self._json(200, read_text_file(rel))
            except ValueError as exc:
                self._json(400, {"error": str(exc)})
            except Exception as exc:
                self._json(500, {"error": str(exc)})
            return

        if path.startswith("/api/install/") and path.endswith("/events"):
            job_id = path.split("/")[3]
            with _jobs_lock:
                job = _jobs.get(job_id)
            if not job:
                self.send_error(404)
                return

            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.end_headers()

            q: queue.Queue = job["queue"]
            while True:
                try:
                    line = q.get(timeout=30)
                except queue.Empty:
                    self.wfile.write(b": keepalive\n\n")
                    self.wfile.flush()
                    continue
                if line is None:
                    self.wfile.write(sse_format("[DONE]"))
                    self.wfile.write(sse_format(job["status"], event="status"))
                    self.wfile.flush()
                    break
                self.wfile.write(sse_format(line.rstrip("\n")))
                self.wfile.flush()
            return

        self.send_error(404)

    def do_POST(self) -> None:
        path = urlparse(self.path).path

        if path == "/api/system/swap":
            try:
                body = self._read_json()
                size_gb = float(body.get("sizeGb") or body.get("size_gb") or 2)
                swap_path = str(body.get("path") or "/swapfile")
                self._json(200, setup_swap(size_gb, swap_path))
            except ValueError as exc:
                self._json(400, {"error": str(exc)})
            except subprocess.CalledProcessError as exc:
                err = (exc.stderr or b"").decode("utf-8", errors="replace").strip()
                self._json(500, {"error": err or str(exc)})
            except Exception as exc:
                self._json(500, {"error": str(exc)})
            return

        if path != "/api/install":
            self.send_error(404)
            return

        if not _install_lock.acquire(blocking=False):
            self._json(409, {"error": "Установка уже выполняется"})
            return

        try:
            body = self._read_json()
            cfg = build_config(body)
            write_env_file(ENV_FILE, cfg)
            (WEBINSTALL_DIR / "last-install.json").write_text(
                json.dumps({k: v for k, v in cfg.items() if "PASSWORD" not in k and "KEY" not in k and "SECRET" not in k and "TOKEN" not in k}, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

            job_id = uuid.uuid4().hex
            with _jobs_lock:
                _jobs[job_id] = {
                    "queue": queue.Queue(),
                    "status": "running",
                    "started": time.time(),
                }

            thread = threading.Thread(
                target=run_install_job,
                args=(job_id, ENV_FILE),
                daemon=True,
            )
            thread.start()

            def release_lock() -> None:
                thread.join()
                _install_lock.release()

            threading.Thread(target=release_lock, daemon=True).start()

            self._json(200, {"jobId": job_id, "envFile": str(ENV_FILE)})
        except ValueError as e:
            _install_lock.release()
            self._json(400, {"error": str(e)})
        except Exception as e:
            _install_lock.release()
            self._json(500, {"error": str(e)})


def main() -> None:
    _configure_console()
    install_script = resolve_install_script(webinstall=True)

    if not install_script.is_file():
        print(f"Ошибка: не найден {install_script}", file=sys.stderr)
        sys.exit(1)

    WEBINSTALL_DIR.mkdir(parents=True, exist_ok=True)

    if not (WEBINSTALL_DIR / "index.html").is_file():
        print(f"Ошибка: нет {WEBINSTALL_DIR / 'index.html'}", file=sys.stderr)
        sys.exit(1)

    env_file = ROOT / ".env"
    direct = "--direct" in sys.argv[1:]

    if env_file.is_file() and direct:
        print()
        print("  🦟  Cicada Studio — Web Install (режим --direct)")
        print("  Найден .env — установка в терминале без веб-формы")
        print()
        env_data = process_env_file(env_file)
        write_env_file(ENV_FILE, env_data)
        sys.exit(run_install_direct(ENV_FILE))

    plat = detect_platform()
    print()
    print("  🦟  Cicada Studio — Web Install")
    print(f"  Платформа: {plat}")
    if env_file.is_file():
        print("  Найден .env — форма будет предзаполнена (установка только по кнопке в UI)")
        print("  Установка в терминале без UI:  python3 webinstall.py --direct")
    print("  Прямая установка из .env без UI:  python3 webinstall.py --direct")
    print()

    global PORT
    preferred = PORT
    if port_is_open("127.0.0.1", preferred):
        owner = describe_port_owner(preferred)
        if owner:
            print(f"  ▲ Порт {preferred} занят: {owner}")
        if try_free_port(preferred):
            print(f"  ✓ Порт {preferred} освобождён (старый webinstall остановлен)")
        else:
            print(
                f"  ▲ Освободите порт:  fuser -k {preferred}/tcp"
                f"  или  WEBINSTALL_PORT={preferred + 1} python3 webinstall.py"
            )

    server, bound_port = create_webinstall_server(HOST, preferred)
    PORT = bound_port

    page_url, page_label = install_page_target(bound_port)
    api_url = browser_url(bound_port)
    if bound_port != preferred:
        print(f"  ⚠ Порт {preferred} занят — используем {bound_port}")
        host = resolve_public_host() or "домен"
        print(f"  ▲ Открывайте именно:  http://{host}:{bound_port}/  (не :{preferred})")
    print(f"  Страница:  {page_label}")
    print(f"  API:       {api_url}")
    print(f"  Слушает:   {HOST}:{bound_port}")
    if api_url.lower().startswith("http://"):
        print(
            f"  ⚠ Только HTTP — не https://…:{bound_port}/ "
            "(иначе 400 Bad request version в логах)"
        )
    print()

    prepare_webinstall_network(bound_port, page_label)
    host_hint = resolve_public_host() or "домен"
    print(
        f"  Свой URL: WEBINSTALL_PUBLIC_URL=http://{host_hint}:{bound_port} python3 webinstall.py"
    )
    print()

    threading.Thread(
        target=lambda p=bound_port: (time.sleep(0.8), open_install_page(p)),
        daemon=True,
    ).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Остановлено.")
        server.shutdown()


if __name__ == "__main__":
    main()
