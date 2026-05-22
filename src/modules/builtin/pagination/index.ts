import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "pagination",
  "name": "Пагинация списка",
  "desc": "Листание длинного списка по страницам",
  "category": "🧭 Навигация и меню",
  "code": "бот \"YOUR_BOT_TOKEN\"\nстарт:\n    ответ \"👋 Добро пожаловать!\"\n    кнопки \"📋 Список\" \"➡️ Вперёд\" \"⬅️ Назад\"\n\nглобально ITEMS_PER_PAGE = 3\n\nпри нажатии \"📋 Список\":\n    сохранить \"page\" = 1\n    использовать показать_страницу\n\nблок показать_страницу:\n    получить \"page\" → page\n    ответ \"📋 Страница {page}\"\n    кнопки \"⬅️ Назад\" \"➡️ Вперёд\" \"🏠 Главная\"\n\nпри нажатии \"➡️ Вперёд\":\n    получить \"page\" → page\n    запомни page = page + 1\n    сохранить \"page\" = page\n    использовать показать_страницу\n\nпри нажатии \"⬅️ Назад\":\n    получить \"page\" → page\n    если page > 1:\n        запомни page = page - 1\n        сохранить \"page\" = page\n    использовать показать_страницу"
};

export function getModuleMeta() {
  return moduleMeta;
}
