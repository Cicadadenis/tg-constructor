from pypdf2 import PdfWriter

writer = PdfWriter()
writer.clone_reader_document_root(reader)

# Пароль: "" - открыть, "secret" - на редактирование
writer.encrypt(user_password="", owner_password="secret",
               permissions_flag=4)  # 4 = только чтение

with open("protected.pdf", "wb") as f:
    writer.write(f)
