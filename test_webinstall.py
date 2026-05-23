#!/usr/bin/env python3
"""
Cicada Studio — веб-установщик (один файл, без зависимостей).

  python3 webinstall.py
  → http://127.0.0.1:7700  (форма в браузере, .env предзаполняет поля)

  python3 webinstall.py --direct
  → установка из .env в терминале (без веб-UI)

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
from urllib.parse import quote, urlparse

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
    
    # Если DOMAIN не задан, но есть API_HOST, используем API_HOST как DOMAIN
    if not env_data.get("DOMAIN") and env_data.get("API_HOST"):
        env_data["DOMAIN"] = env_data["API_HOST"]
    
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
    elif not admin_email:
        raise ValueError("Email администратора обязателен")
    elif mode == "local":
        if len(admin_password) < 8:
            raise ValueError("Пароль входа — минимум 8 символов (LOCAL)")
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
        "CONFIRM": "y",
        "NODE_ENV": "development" if platform == "termux" or mode == "local" else "production",
        "AUTH_BYPASS": "1" if platform == "termux" else "0",
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


def public_api_base() -> str:
    """
    Базовый URL API webinstall (без завершающего /).
    WSL/Termux → 127.0.0.1; VPS → домен/IP сервера.
    """
    custom = os.environ.get("WEBINSTALL_PUBLIC_URL", "").strip().rstrip("/")
    if custom:
        return custom

    plat = detect_platform()
    if plat in ("wsl", "termux"):
        return f"http://127.0.0.1:{PORT}"

    env_path = ROOT / ".env"
    if env_path.is_file():
        env_data = parse_env_file(env_path)
        host = (env_data.get("API_HOST") or env_data.get("DOMAIN") or "").strip()
        if host and host not in ("localhost", "127.0.0.1"):
            return f"http://{host}:{PORT}"

    ip = guess_public_ipv4()
    if ip:
        return f"http://{ip}:{PORT}"

    if HOST not in ("0.0.0.0", "::", ""):
        return f"http://{HOST}:{PORT}"
    return f"http://127.0.0.1:{PORT}"


def browser_url() -> str:
    return f"{public_api_base()}/"


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


def install_page_target() -> tuple[str, str]:
    """
    (url для браузера, подпись для консоли).
    WSL/Termux/Windows: HTTP на 127.0.0.1 (форма и API на одном origin).
    VPS: http://домен-или-ip:PORT/
    """
    api = public_api_base()
    plat = detect_platform()

    if plat == "vps":
        page = f"{api}/"
        return page, page

    # Надёжнее file:// — fetch /api/info с того же origin (WSL → Chrome в Windows)
    page = f"http://127.0.0.1:{PORT}/"
    return page, page


def open_install_page() -> None:
    if os.environ.get("WEBINSTALL_NO_BROWSER"):
        return
    page_url, page_label = install_page_target()
    plat = detect_platform()
    try:
        if plat == "wsl" or sys.platform == "win32":
            # Windows надёжнее открывает путь C:\... чем file:// из WSL
            target = page_label if "\\" in page_label or ":" in page_label[:3] else page_url
            subprocess.Popen(
                ["cmd.exe", "/c", "start", "", target],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            return
        import webbrowser

        webbrowser.open(page_url)
    except OSError:
        pass


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

    return {
        "hostname": socket.gethostname(),
        "platform": platform.platform(),
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

    return {
        "hostname": socket.gethostname(),
        "platform": platform.platform(),
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


class Handler(BaseHTTPRequestHandler):
    server_version = "CicadaWebInstall/1.0"

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

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
            api_base = public_api_base()
            payload: dict = {
                "platform": plat,
                "termux": plat == "termux",
                "root": os.geteuid() == 0 if hasattr(os, "geteuid") else False,
                "port": PORT,
                "app_dir": str(ROOT),
                "url": browser_url(),
                "api_base": api_base,
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
    page_url, page_label = install_page_target()
    api_url = browser_url()
    print()
    print("  🦟  Cicada Studio — Web Install")
    print(f"  Платформа: {plat}")
    if env_file.is_file():
        print("  Найден .env — форма будет предзаполнена (установка только по кнопке в UI)")
        print("  Установка в терминале без UI:  python3 webinstall.py --direct")
    print(f"  Страница:  {page_label}")
    print(f"  API:       {api_url}")
    if not os.environ.get("WEBINSTALL_NO_BROWSER"):
        print("  Если браузер не открылся — вставьте URL выше в Chrome/Edge")
    if plat == "termux":
        print(f"  Termux: Chrome → {api_url}")
    elif plat == "vps":
        print(f"  VPS: форма и установка → {api_url}")
        print("  Свой URL API: WEBINSTALL_PUBLIC_URL=http://IP:7700 python3 webinstall.py")
    print("  Прямая установка из .env без UI:  python3 webinstall.py --direct")
    print()

    global PORT
    preferred = PORT
    server, bound_port = create_webinstall_server(HOST, preferred)
    if bound_port != preferred:
        PORT = bound_port
        page_url, page_label = install_page_target()
        api_url = browser_url()
        print(f"  ⚠ Порт {preferred} уже занят — сервер запущен на порту {bound_port}")
        print(f"  Страница:  {page_label}")
        print(f"  API:       {api_url}")
        print()

    threading.Thread(
        target=lambda: (time.sleep(0.8), open_install_page()),
        daemon=True,
    ).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Остановлено.")
        server.shutdown()


if __name__ == "__main__":
    main()
