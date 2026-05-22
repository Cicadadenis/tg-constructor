import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "main_menu",
  "name": "Главное меню с кнопками",
  "desc": "Стандартное главное меню",
  "category": "🧭 Навигация и меню",
  "code": "бот \"YOUR_BOT_TOKEN\"\n\nблок главное_меню:\n    ответ \"🏠 Главное меню\"\n    кнопки:\n        [\"📦 Каталог\", \"🛒 Корзина\"]\n        [\"👤 Профиль\", \"❓ Помощь\"]\n\nстарт:\n    использовать главное_меню\n\nпри нажатии \"🏠 Главная\":\n    использовать главное_меню"
};

export function getModuleMeta() {
  return moduleMeta;
}
