import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "tg_chat_type",
  "name": "Определение типа чата",
  "desc": "Реагирует по-разному в личке, группе и супергруппе",
  "category": "📡 Telegram расширения",
  "code": "бот \"YOUR_BOT_TOKEN\"\n\nдо каждого:\n    если чат.тип == \"группа\" или чат.тип == \"супергруппа\":\n        ответ \"⚠️ В групповых чатах доступны только команды /help и /info\"\n        вернуть\n\nстарт:\n    если чат.тип == \"личка\":\n        ответ \"👋 Привет, {пользователь.имя}! Это личный чат.\"\n        кнопки \"📋 Меню\"\n    иначе:\n        ответ \"👋 Бот активирован в чате: {чат.тип}\""
};

export function getModuleMeta() {
  return moduleMeta;
}
