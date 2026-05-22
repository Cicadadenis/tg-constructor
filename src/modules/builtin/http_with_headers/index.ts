import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "http_with_headers",
  "name": "HTTP с заголовками авторизации",
  "desc": "Устанавливает заголовки для API с токеном",
  "category": "🌐 HTTP и внешние API",
  "code": "бот \"YOUR_BOT_TOKEN\"\nстарт:\n    ответ \"👋 Добро пожаловать!\"\n    кнопки \"🔐 Защищённый запрос\"\n\nглобально API_TOKEN = \"Bearer my_secret_token_here\"\n\nпри нажатии \"🔐 Защищённый запрос\":\n    запомни headers = {\"Authorization\": API_TOKEN, \"Content-Type\": \"application/json\"}\n    http_заголовки headers\n    http_get \"https://api.example.com/profile\" → ответ\n    запомни профиль = разобрать_json(ответ)\n    ответ \"👤 Профиль из API:\n{профиль.name}\"\n    кнопки \"🏠 Главная\""
};

export function getModuleMeta() {
  return moduleMeta;
}
