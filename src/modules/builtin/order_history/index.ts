import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "order_history",
  "name": "История заказов",
  "desc": "Просмотр прошлых заказов пользователя",
  "category": "🛒 Корзина и заказы",
  "code": "бот \"YOUR_BOT_TOKEN\"\nстарт:\n    ответ \"👋 Добро пожаловать!\"\n    кнопки \"📋 Мои заказы\"\n\nпри нажатии \"📋 Мои заказы\":\n    получить \"заказы\" → заказы\n    если не заказы:\n        ответ \"📋 У вас пока нет заказов\"\n        кнопки \"🛒 Перейти в каталог\"\n    иначе:\n        ответ \"📋 Ваши заказы:\n{заказы}\"\n        кнопки \"🏠 Главная\""
};

export function getModuleMeta() {
  return moduleMeta;
}
