import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "http_patch",
  "name": "HTTP PATCH — частичное обновление",
  "desc": "Обновляет часть ресурса через PATCH-запрос",
  "category": "🌐 HTTP и внешние API",
  "code": "бот \"YOUR_BOT_TOKEN\"\nстарт:\n    ответ \"👋 Добро пожаловать!\"\n    кнопки \"✏️ Обновить запись\"\n\nпри нажатии \"✏️ Обновить запись\":\n    спросить \"📝 Новый заголовок:\" → заголовок\n    запомни данные = {\"title\": заголовок}\n    http_patch \"https://jsonplaceholder.typicode.com/posts/1\" json данные → ответ\n    запомни результат = разобрать_json(ответ)\n    ответ \"✅ Обновлено! Новый заголовок: {результат.title}\"\n    кнопки \"🏠 Главная\""
};

export function getModuleMeta() {
  return moduleMeta;
}
