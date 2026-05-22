#!/usr/bin/env python3
"""
Cicada Studio — веб-установщик (один файл, без зависимостей).

  python3 webinstall.py
  → http://127.0.0.1:7700

Форма → webinstall/last-install.env → setup.sh --webinstall (логи по SSE).
"""
from __future__ import annotations

import json
import os
import queue
import secrets
import shutil
import subprocess
import sys
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

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
    if not admin_email:
        raise ValueError("Email администратора обязателен")
    if mode == "local":
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
    }


def run_install_job(job_id: str, env_path: Path) -> None:
    job = _jobs[job_id]
    q: queue.Queue = job["queue"]

    def push(line: str) -> None:
        q.put(line)

    # Приоритет: bootstrap.sh, если нет - setup.sh
    install_script = BOOTSTRAP_SH if BOOTSTRAP_SH.is_file() else SETUP_SH
    
    if not install_script.is_file():
        push(f"ERROR: {install_script.name} не найден\n")
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
    # Приоритет: bootstrap.sh, если нет - setup.sh
    install_script = BOOTSTRAP_SH if BOOTSTRAP_SH.is_file() else SETUP_SH
    
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


def load_html() -> bytes:
    path = WEBINSTALL_DIR / "index.html"
    if not path.is_file():
        raise FileNotFoundError(f"Нет {path}")
    return path.read_bytes()


class Handler(BaseHTTPRequestHandler):
    server_version = "CicadaWebInstall/1.0"

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

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
            self._json(
                200,
                {
                    "platform": plat,
                    "termux": plat == "termux",
                    "root": os.geteuid() == 0 if hasattr(os, "geteuid") else False,
                    "port": PORT,
                    "app_dir": str(ROOT),
                },
            )
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
    # Приоритет: bootstrap.sh, если нет - setup.sh
    install_script = BOOTSTRAP_SH if BOOTSTRAP_SH.is_file() else SETUP_SH
    
    if not install_script.is_file():
        print(f"Ошибка: не найден {install_script}", file=sys.stderr)
        sys.exit(1)

    WEBINSTALL_DIR.mkdir(parents=True, exist_ok=True)
    
    # Проверяем наличие .env файла в корне проекта
    env_file = ROOT / ".env"
    if env_file.is_file():
        print()
        print("  🦟  Cicada Studio — Web Install")
        print(f"  Найден файл .env, используем его конфигурацию")
        print()
        
        # Обрабатываем .env файл (добавляем DOMAIN если есть API_HOST)
        env_data = process_env_file(env_file)
        
        # Записываем обработанные данные в webinstall/last-install.env
        write_env_file(ENV_FILE, env_data)
        
        # Запускаем установку напрямую
        sys.exit(run_install_direct(ENV_FILE))
    
    # Если .env нет - запускаем веб-сервер
    if not (WEBINSTALL_DIR / "index.html").is_file():
        print(f"Ошибка: нет {WEBINSTALL_DIR / 'index.html'}", file=sys.stderr)
        sys.exit(1)

    plat = detect_platform()
    print()
    print("  🦟  Cicada Studio — Web Install")
    print(f"  Платформа: {plat}")
    print(f"  Открой в браузере:  http://{HOST}:{PORT}/")
    if plat == "termux":
        print(f"  Termux: Chrome → http://127.0.0.1:{PORT}/")
    print()

    server = ThreadingHTTPServer((HOST, PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Остановлено.")
        server.shutdown()


if __name__ == "__main__":
    main()
