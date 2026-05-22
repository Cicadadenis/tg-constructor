import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "http_put",
  "name": "HTTP PUT — полное обновление",
  "desc": "Полностью заменяет ресурс через PUT-запрос",
  "category": "🌐 HTTP и внешние API",
  "code": "бот \"YOUR_BOT_TOKEN\"\nстарт:\n    ответ \"👋 Добро пожаловать!\"\n    кнопки \"🔄 Заменить запись\"\n\nпри нажатии \"🔄 Заменить запись\":\n    спросить \"📝 Заголовок:\" → заголовок\n    спросить \"📄 Текст:\" → текст\n    запомни данные = {\"title\": заголовок, \"body\": текст, \"userId\": 1}\n    http_put \"https://jsonplaceholder.typicode.com/posts/1\" json данные → ответ\n    ответ \"✅ Запись заменена!\"\n    кнопки \"🏠 Главная\""
};

export function getModuleMeta() {
  return moduleMeta;
}
