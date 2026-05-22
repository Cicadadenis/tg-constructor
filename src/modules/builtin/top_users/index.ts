import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "top_users",
  "name": "Топ пользователей",
  "desc": "Рейтинг пользователей по активности",
  "category": "📊 Статистика и аналитика",
  "code": "бот \"YOUR_BOT_TOKEN\"\nстарт:\n    ответ \"👋 Добро пожаловать!\"\n    кнопки \"🏆 Топ\"\n\nпри нажатии \"🏆 Топ\":\n    получить \"мои_очки\" → очки\n    если не очки:\n        запомни очки = 0\n    ответ \"🏆 Рейтинг пользователей:\n\n🥇 Пользователь1 — 500 очков\n🥈 Пользователь2 — 320 очков\n🥉 Пользователь3 — 210 очков\n\n📍 Ваш счёт: {очки} очков\"\n    кнопки \"🏠 Главная\""
};

export function getModuleMeta() {
  return moduleMeta;
}
