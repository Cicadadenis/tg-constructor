import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "db_save_simple",
  "name": "Сохранить одно значение",
  "desc": "Записывает одно значение в БД пользователя по ключу",
  "category": "🗃️ База данных (per-user)",
  "code": "бот \"YOUR_BOT_TOKEN\"\nстарт:\n    ответ \"👋 Добро пожаловать!\"\n    кнопки \"💾 Сохранить\"\n\n# сохранить \"ключ\" = значение\n# Данные хранятся в БД per-user — каждый пользователь видит только свои\n\nпри нажатии \"💾 Сохранить\":\n    спросить \"✏️ Введите значение:\" → значение\n    сохранить \"моё_поле\" = значение\n    ответ \"✅ Сохранено!\"\n    кнопки \"📖 Прочитать\" \"🏠 Главная\""
};

export function getModuleMeta() {
  return moduleMeta;
}
