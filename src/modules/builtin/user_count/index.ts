import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "user_count",
  "name": "Количество пользователей (админ)",
  "desc": "Глобальный счётчик пользователей через глобальную БД",
  "category": "📊 Статистика и аналитика",
  "code": "бот \"YOUR_BOT_TOKEN\"\n\nглобально ADMIN_ID = \"123456789\"\n\nпри нажатии \"📊 Статистика\":\n    если пользователь.id != ADMIN_ID:\n        ответ \"⛔ Нет доступа\"\n        стоп\n    # Читаем из глобальной БД\n    получить \"total_users\" → total_users\n    если не total_users:\n        запомни total_users = 0\n    ответ \"📊 Статистика бота:\n👥 Всего пользователей: {total_users}\n📅 Дата: {текущая_дата}\"\n    кнопки \"👑 Панель\"\n\nстарт:\n    ответ \"👋 Добро пожаловать!\"\n    кнопки \"📊 Статистика\"\n    # Инкремент в глобальную (не per-user) БД\n    получить \"total_users\" → total_users\n    если не total_users:\n        запомни total_users = 0\n    запомни total_users = total_users + 1\n    сохранить_глобально \"total_users\" = total_users"
};

export function getModuleMeta() {
  return moduleMeta;
}
