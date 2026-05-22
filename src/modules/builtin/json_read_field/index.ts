import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "json_read_field",
  "name": "Прочитать поле из БД",
  "desc": "Читает конкретное поле из БД пользователя по ключу",
  "category": "🗄️ JSON-хранилище (per-user)",
  "code": "бот \"YOUR_BOT_TOKEN\"\nстарт:\n    ответ \"👋 Добро пожаловать!\"\n    кнопки \"📖 Прочитать данные\"\n\nпри нажатии \"📖 Прочитать данные\":\n    получить \"моё_поле\" → значение\n    если не значение:\n        ответ \"📭 У вас ещё нет сохранённых данных.\"\n        кнопки \"💾 Сохранить данные\" \"🏠 Главная\"\n        стоп\n    ответ \"📖 Ваше значение: {значение}\"\n    кнопки \"🏠 Главная\""
};

export function getModuleMeta() {
  return moduleMeta;
}
