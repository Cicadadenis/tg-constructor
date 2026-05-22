import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "admin_menu",
  "name": "Меню для админа",
  "desc": "Отдельное меню с расширенными функциями для администратора",
  "category": "🧭 Навигация и меню",
  "code": "бот \"YOUR_BOT_TOKEN\"\n\nглобально ADMIN_ID = \"123456789\"\n\nстарт:\n    если пользователь.id == ADMIN_ID:\n        ответ \"👑 Панель администратора\"\n        кнопки:\n            [\"👥 Пользователи\", \"📊 Статистика\"]\n            [\"📢 Рассылка\", \"⚙️ Настройки\"]\n    иначе:\n        ответ \"👋 Привет, {пользователь.имя}!\"\n        кнопки \"📋 Меню\" \"❓ Помощь\""
};

export function getModuleMeta() {
  return moduleMeta;
}
