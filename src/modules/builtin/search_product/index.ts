import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "search_product",
  "name": "Поиск товара",
  "desc": "Поиск товара по названию",
  "category": "🛍️ Магазин и товары",
  "code": "бот \"YOUR_BOT_TOKEN\"\nстарт:\n    ответ \"👋 Добро пожаловать!\"\n    кнопки \"🔍 Поиск\"\n\nпри нажатии \"🔍 Поиск\":\n    спросить \"🔍 Введите название товара для поиска:\" → запрос\n    сохранить \"поиск_запрос\" = запрос\n    ответ \"🔍 Результаты поиска по запросу: «{запрос}»\n\n📦 Товар 1 — 100₽\n📦 Товар 2 — 250₽\"\n    кнопки \"📦 Товар 1\" \"📦 Товар 2\" \"🔙 Назад\""
};

export function getModuleMeta() {
  return moduleMeta;
}
