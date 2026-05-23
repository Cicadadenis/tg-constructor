#!/usr/bin/env python3
"""Шифрование файлов AES-256-CBC (salt 16 + IV 16 + ciphertext)."""
from __future__ import annotations

import hashlib
import getpass
import os
import shutil
import subprocess
import sys


def _pip_available() -> bool:
    return (
        subprocess.run(
            [sys.executable, "-m", "pip", "--version"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        ).returncode
        == 0
    )


def _run_as_root_apt(packages: list[str]) -> bool:
    if not shutil.which("apt-get"):
        return False
    cmd = ["apt-get", "install", "-y", "-qq", *packages]
    if os.geteuid() == 0:
        proc = subprocess.run(cmd, capture_output=True)
        return proc.returncode == 0
    sudo = shutil.which("sudo")
    if not sudo:
        return False
    proc = subprocess.run([sudo, "-n", *cmd], capture_output=True)
    return proc.returncode == 0


def _ensure_pip() -> None:
    if _pip_available():
        return
    print("📦 Устанавливается pip…")
    if _run_as_root_apt(["python3-pip", "python3-venv"]):
        if _pip_available():
            return
    try:
        subprocess.check_call(
            [sys.executable, "-m", "ensurepip", "--upgrade"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except (subprocess.CalledProcessError, OSError):
        pass
    if not _pip_available():
        raise SystemExit(
            "❌ На сервере нет pip. Установите вручную:\n"
            "  sudo apt update && sudo apt install -y python3-pip\n"
            "  python3 -m pip install pyaes\n"
            "  # или: sudo apt install -y python3-pyaes  (если пакет есть в репозитории)"
        )


def _install_pyaes_pip() -> None:
    _ensure_pip()
    base = [sys.executable, "-m", "pip", "install", "pyaes", "-q"]
    for extra in ([], ["--break-system-packages"]):
        try:
            subprocess.check_call([*base, *extra], stdout=subprocess.DEVNULL)
            return
        except subprocess.CalledProcessError:
            continue
    raise SystemExit(
        "❌ Не удалось установить pyaes через pip.\n"
        "  sudo apt install -y python3-pip && python3 -m pip install pyaes"
    )


def _import_pyaes():
    try:
        import pyaes  # type: ignore[import-untyped]

        return pyaes
    except ImportError:
        pass

    print("📦 Устанавливается pyaes…")
    # Системный пакет Debian/Ubuntu (без pip)
    if _run_as_root_apt(["python3-pyaes"]):
        try:
            import pyaes  # type: ignore[import-untyped]

            return pyaes
        except ImportError:
            pass

    _install_pyaes_pip()
    import pyaes  # type: ignore[import-untyped]

    return pyaes


pyaes = _import_pyaes()


def get_key(password: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        480_000,
        dklen=32,
    )


def encrypt_file(input_path: str, output_path: str, password: str) -> None:
    """Совместимо с pass.py: AES-CBC + PKCS7, поблочный encrypt."""
    salt = os.urandom(16)
    iv = os.urandom(16)
    key = get_key(password, salt)
    aes = pyaes.AESModeOfOperationCBC(key, iv=iv)

    with open(input_path, "rb") as f:
        data = f.read()

    pad_len = 16 - len(data) % 16
    data += bytes([pad_len] * pad_len)

    encrypted = b"".join(
        aes.encrypt(data[i : i + 16]) for i in range(0, len(data), 16)
    )

    with open(output_path, "wb") as f:
        f.write(salt + iv + encrypted)

    print(f"✅ Зашифровано: {output_path}")


def decrypt_file(input_path: str, output_path: str, password: str) -> None:
    """Совместимо с pass.py: те же salt/iv и поблочный decrypt."""
    with open(input_path, "rb") as f:
        raw = f.read()

    if len(raw) < 32:
        raise ValueError("Файл повреждён")

    salt = raw[:16]
    iv = raw[16:32]
    encrypted = raw[32:]

    if len(encrypted) % 16 != 0:
        raise ValueError("Файл повреждён")

    key = get_key(password, salt)
    aes = pyaes.AESModeOfOperationCBC(key, iv=iv)

    decrypted = b"".join(
        aes.decrypt(encrypted[i : i + 16]) for i in range(0, len(encrypted), 16)
    )

    if not decrypted:
        raise ValueError("Неверный пароль")

    pad_len = decrypted[-1]
    if pad_len < 1 or pad_len > 16:
        raise ValueError("Неверный пароль")

    decrypted = decrypted[:-pad_len]

    with open(output_path, "wb") as f:
        f.write(decrypted)

    print(f"✅ Расшифровано: {output_path}")


def main() -> None:
    print("=== Шифрование файлов ===")
    print("1. Зашифровать")
    print("2. Расшифровать")

    choice = input("Выбор (1/2): ").strip()

    if choice == "1":
        input_path = input("Файл для шифрования: ").strip()
        if not os.path.isfile(input_path):
            print("❌ Файл не найден")
            return

        output_path = input("Сохранить как (.enc): ").strip()
        if not output_path:
            output_path = input_path + ".enc"

        password = getpass.getpass("Пароль: ")
        confirm = getpass.getpass("Повторите пароль: ")
        if password != confirm:
            print("❌ Пароли не совпадают")
            return

        encrypt_file(input_path, output_path, password)

    elif choice == "2":
        input_path = input("Файл для расшифровки: ").strip()
        if not os.path.isfile(input_path):
            print("❌ Файл не найден")
            return

        output_path = input("Сохранить как: ").strip()
        if not output_path:
            output_path = (
                input_path[:-4]
                if input_path.endswith(".enc")
                else input_path + ".dec"
            )

        password = getpass.getpass("Пароль: ")
        try:
            decrypt_file(input_path, output_path, password)
        except ValueError as e:
            print(f"❌ Ошибка: {e}")

    else:
        print("❌ Неверный выбор")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nОтменено.")
        sys.exit(130)
