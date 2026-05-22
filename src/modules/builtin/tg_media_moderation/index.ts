import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "tg_media_moderation",
  "name": "Модерация медиа",
  "desc": "Пересылает фото и документы администратору на проверку",
  "category": "📡 Telegram расширения",
  "code": "бот \"YOUR_BOT_TOKEN\"\n\nглобально ADMIN_ID = \"123456789\"\n\nпри фото:\n    переслать сообщение ADMIN_ID\n    ответ \"📸 Фото отправлено модератору.\"\n\nпри документе:\n    переслать сообщение ADMIN_ID\n    ответ \"📎 Документ отправлен модератору.\"\n\nпри стикере:\n    переслать сообщение ADMIN_ID\n    ответ \"🙂 Стикер отправлен модератору.\""
};

export function getModuleMeta() {
  return moduleMeta;
}
