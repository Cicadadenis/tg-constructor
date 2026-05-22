import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "http_get_basic",
  "name": "HTTP GET запрос",
  "desc": "Получить данные от внешнего API",
  "category": "🌐 HTTP и внешние API",
  "code": "бот \"YOUR_BOT_TOKEN\"\nстарт:\n    ответ \"👋 Добро пожаловать!\"\n    кнопки \"🌐 Получить данные\"\n\nпри нажатии \"🌐 Получить данные\":\n    http_get \"https://jsonplaceholder.typicode.com/todos/1\" → ответ\n    запомни данные = разобрать_json(ответ)\n    ответ \"📄 Задача:\n{данные.title}\nВыполнена: {данные.completed}\"\n    кнопки \"🔄 Обновить\" \"🏠 Главная\""
};

export function getModuleMeta() {
  return moduleMeta;
}
