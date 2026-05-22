import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "webhook_notify",
  "name": "Webhook — отправка уведомления",
  "desc": "Отправляет событие во внешний сервис (n8n, Make, Zapier)",
  "category": "🌐 HTTP и внешние API",
  "code": "бот \"YOUR_BOT_TOKEN\"\nстарт:\n    ответ \"👋 Добро пожаловать!\"\n    кнопки \"📤 Отправить событие\"\n\nглобально WEBHOOK_URL = \"https://hook.eu1.make.com/your_webhook_id\"\n\nпри нажатии \"📤 Отправить событие\":\n    получить \"профиль_имя\" → имя\n    запомни event = {\"event\": \"button_click\", \"user_id\": пользователь.id, \"user_name\": имя, \"timestamp\": текущий_timestamp}\n    http_post WEBHOOK_URL json event → resp\n    ответ \"✅ Событие отправлено в webhook!\"\n    кнопки \"🏠 Главная\""
};

export function getModuleMeta() {
  return moduleMeta;
}
