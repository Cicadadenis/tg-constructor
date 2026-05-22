import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "tg_inline_router",
  "name": "Inline-меню с роутером callback",
  "desc": "Одним обработчиком разбирает callback_data по префиксам",
  "category": "📡 Telegram расширения",
  "code": "бот \"YOUR_BOT_TOKEN\"\n\nстарт:\n    ответ \"Выберите раздел:\"\n    inline-кнопки:\n        [\"📦 Каталог\" → \"menu:catalog\", \"👤 Профиль\" → \"menu:profile\"]\n        [\"❓ Помощь\" → \"menu:help\"]\n\nпри нажатии:\n    если начинается_с(кнопка, \"menu:\"):\n        запомни раздел = срез(кнопка, 5)\n        если раздел == \"catalog\":\n            ответ \"📦 Каталог товаров\"\n            вернуть\n        если раздел == \"profile\":\n            ответ \"👤 Ваш профиль\"\n            вернуть\n        если раздел == \"help\":\n            ответ \"❓ Помощь по боту\"\n            вернуть"
};

export function getModuleMeta() {
  return moduleMeta;
}
