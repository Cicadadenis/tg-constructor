import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "json_to_string",
  "name": "Объект в JSON-строку",
  "desc": "Сериализация объекта в JSON-строку для отправки в API",
  "category": "📁 Файлы и JSON",
  "code": "бот \"YOUR_BOT_TOKEN\"\nстарт:\n    ответ \"👋 Добро пожаловать!\"\n    кнопки \"📤 Отправить данные в API\"\n\nпри нажатии \"📤 Отправить данные в API\":\n    получить \"профиль_имя\" → имя\n    получить \"профиль_email\" → email\n    # Собираем объект и конвертируем в JSON-строку\n    запомни payload = {\"name\": имя, \"email\": email, \"source\": \"cicada-bot\"}\n    запомни json_строка = в_json(payload)\n    лог \"Отправляем: {json_строка}\"\n    http_post \"https://api.example.com/users\" json payload → resp\n    ответ \"✅ Отправлено! Ответ: {resp}\"\n    кнопки \"🏠 Главная\""
};

export function getModuleMeta() {
  return moduleMeta;
}
