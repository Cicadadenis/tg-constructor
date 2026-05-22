import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "ticket_system",
  "name": "Тикет система",
  "desc": "Создание обращений в поддержку с уведомлением администратора",
  "category": "🆘 Поддержка",
  "code": "бот \"YOUR_BOT_TOKEN\"\nстарт:\n    ответ \"👋 Добро пожаловать!\"\n    кнопки \"🎫 Создать обращение\"\n\nглобально ADMIN_ID = \"123456789\"\n\nсценарий создать_тикет:\n    шаг тема:\n        спросить \"📝 Тема обращения:\" → тема\n    шаг описание:\n        спросить \"📄 Опишите проблему подробно:\" → описание\n    шаг создание:\n        получить \"ticket_count\" → ticket_count\n        если не ticket_count:\n            запомни ticket_count = 0\n        запомни ticket_count = ticket_count + 1\n        запомни ticket_id = ticket_count\n        сохранить \"ticket_count\" = ticket_count\n        сохранить \"ticket_{ticket_id}_тема\" = тема\n        сохранить \"ticket_{ticket_id}_статус\" = \"открыт\"\n        уведомить ADMIN_ID: \"🎫 Новый тикет №{ticket_id}\nОт: {пользователь.имя} (ID: {пользователь.id})\nТема: {тема}\nОписание: {описание}\"\n        ответ \"✅ Тикет №{ticket_id} создан!\nСтатус: открыт\nМы ответим в течение 24 часов.\"\n        кнопки \"🏠 Главная\"\n        стоп\n\nпри нажатии \"🎫 Создать обращение\":\n    перейти \"создать_тикет\""
};

export function getModuleMeta() {
  return moduleMeta;
}
