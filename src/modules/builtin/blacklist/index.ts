import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "blacklist",
  "name": "Blacklist / бан пользователя",
  "desc": "Блокировка определённых пользователей",
  "category": "🔐 Доступ и авторизация",
  "code": "бот \"YOUR_BOT_TOKEN\"\n\nстарт:\n    ответ \"👋 Добро пожаловать!\"\n    кнопки \"🏠 Главное меню\"\n    получить \"banned\" → banned\n    если banned == \"да\":\n        ответ \"🚫 Вы заблокированы в этом боте.\"\n        стоп\n    ответ \"👋 Привет, {пользователь.имя}!\"\n\nкоманда \"/ban\":\n    получить \"is_admin\" → is_admin\n    если не is_admin:\n        ответ \"⛔ Нет доступа\"\n        стоп\n    спросить \"Введите ID пользователя для блокировки:\" → ban_id\n    сохранить \"banned_{ban_id}\" = \"да\"\n    ответ \"✅ Пользователь {ban_id} заблокирован\"\n    кнопки \"🏠 Главное меню\"\n\nпри нажатии \"🏠 Главное меню\":\n    ответ \"🏠 Меню модератора\"\n    кнопки \"🏠 Главное меню\""
};

export function getModuleMeta() {
  return moduleMeta;
}
