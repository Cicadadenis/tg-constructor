import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "json_save_field",
  "name": "Сохранить поле в JSON",
  "desc": "Записывает одно поле в БД пользователя по ключу",
  "category": "🗄️ JSON-хранилище (per-user)",
  "code": "бот \"YOUR_BOT_TOKEN\"\nстарт:\n    ответ \"👋 Добро пожаловать!\"\n    кнопки \"💾 Сохранить\"\n\nпри нажатии \"💾 Сохранить\":\n    спросить \"✏️ Введите значение для сохранения:\" → значение\n    сохранить \"моё_поле\" = значение\n    ответ \"✅ Поле сохранено: {значение}\"\n    кнопки \"🏠 Главная\""
};

export function getModuleMeta() {
  return moduleMeta;
}
