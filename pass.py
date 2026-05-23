import pyaes
import hashlib
import os
import getpass

def get_key(password: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 480000, dklen=32)

def encrypt_file(input_path: str, output_path: str, password: str):
    salt = os.urandom(16)
    iv = os.urandom(16)
    key = get_key(password, salt)
    aes = pyaes.AESModeOfOperationCBC(key, iv=iv)

    with open(input_path, "rb") as f:
        data = f.read()

    pad_len = 16 - len(data) % 16
    data += bytes([pad_len] * pad_len)

    encrypted = b""
    for i in range(0, len(data), 16):
        encrypted += aes.encrypt(data[i:i+16])

    with open(output_path, "wb") as f:
        f.write(salt + iv + encrypted)

    print(f"✅ Зашифровано: {output_path}")

def decrypt_file(input_path: str, output_path: str, password: str):
    with open(input_path, "rb") as f:
        raw = f.read()

    salt = raw[:16]
    iv = raw[16:32]
    encrypted = raw[32:]
    key = get_key(password, salt)
    aes = pyaes.AESModeOfOperationCBC(key, iv=iv)

    decrypted = b""
    for i in range(0, len(encrypted), 16):
        decrypted += aes.decrypt(encrypted[i:i+16])

    pad_len = decrypted[-1]
    decrypted = decrypted[:-pad_len]

    with open(output_path, "wb") as f:
        f.write(decrypted)

    print(f"✅ Расшифровано: {output_path}")

def main():
    print("=== Шифрование файлов ===")
    print("1. Зашифровать")
    print("2. Расшифровать")
    choice = input("Выбор (1/2): ").strip()

    if choice == "1":
        input_path = input("Файл для шифрования: ").strip()
        output_path = input("Сохранить как (Enter = input_path + .enc): ").strip()
        if not output_path:
            output_path = input_path + ".enc"
        password = getpass.getpass("Пароль: ")
        confirm = getpass.getpass("Подтвердите пароль: ")
        if password != confirm:
            print("❌ Пароли не совпадают")
            return
        if not os.path.exists(input_path):
            print(f"❌ Файл не найден: {input_path}")
            return
        encrypt_file(input_path, output_path, password)

    elif choice == "2":
        input_path = input("Файл для расшифровки: ").strip()
        output_path = input("Сохранить как (Enter = убрать .enc): ").strip()
        if not output_path:
            output_path = input_path.removesuffix(".enc") or input_path + ".dec"
        password = getpass.getpass("Пароль: ")
        if not os.path.exists(input_path):
            print(f"❌ Файл не найден: {input_path}")
            return
        try:
            decrypt_file(input_path, output_path, password)
        except Exception:
            print("❌ Ошибка расшифровки — неверный пароль или повреждён файл")

    else:
        print("❌ Неверный выбор")

if __name__ == "__main__":
    main()
