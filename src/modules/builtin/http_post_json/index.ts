import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "http_post_json",
  "name": "HTTP POST с JSON-телом",
  "desc": "Отправить JSON-данные в API через переменную",
  "category": "🌐 HTTP и внешние API",
  "code": "бот \"YOUR_BOT_TOKEN\"\nстарт:\n    ответ \"👋 Добро пожаловать!\"\n    кнопки \"📤 Создать запись\"\n\nпри нажатии \"📤 Создать запись\":\n    получить \"профиль_имя\" → имя\n    # Формируем JSON-объект и отправляем напрямую (auto JSON)\n    запомни payload = {\"title\": \"Новая запись\", \"body\": \"Текст от {имя}\", \"userId\": 1}\n    http_post \"https://jsonplaceholder.typicode.com/posts\" json payload → ответ\n    запомни создан = разобрать_json(ответ)\n    ответ \"✅ Создана запись ID: {создан.id}\"\n    кнопки \"🏠 Главная\""
};

export function getModuleMeta() {
  return moduleMeta;
}
