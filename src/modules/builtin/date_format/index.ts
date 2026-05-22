import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "date_format",
  "name": "Форматирование даты",
  "desc": "Конвертация даты из одного формата в другой",
  "category": "🕐 Дата и время",
  "code": "бот \"YOUR_BOT_TOKEN\"\nстарт:\n    ответ \"👋 Добро пожаловать!\"\n    кнопки \"🗓️ Форматы дат\"\n\nпри нажатии \"🗓️ Форматы дат\":\n    запомни дата = текущая_дата\n    # Исходный формат: DD.MM.YYYY\n    # Форматирование через маску\n    запомни формат1 = формат_даты(дата, \"DD/MM/YYYY\")\n    запомни формат2 = формат_даты(дата, \"YYYY-MM-DD\")\n    ответ \"📅 Дата в разных форматах:\n• {дата}\n• {формат1}\n• {формат2}\"\n    кнопки \"🏠 Главная\""
};

export function getModuleMeta() {
  return moduleMeta;
}
