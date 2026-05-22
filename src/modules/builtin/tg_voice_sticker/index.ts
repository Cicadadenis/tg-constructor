import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "tg_voice_sticker",
  "name": "Голосовые и стикеры",
  "desc": "Принимает голосовые сообщения и стикеры, сохраняет file_id",
  "category": "📡 Telegram расширения",
  "code": "бот \"YOUR_BOT_TOKEN\"\n\nпри голосовом:\n    сохранить \"последнее_голосовое\" = файл_id\n    ответ \"🎙️ Голосовое получено и сохранено.\"\n    голос файл_id\n\nпри стикере:\n    сохранить \"последний_стикер\" = файл_id\n    ответ \"🙂 Стикер получен: {стикер_emoji}\"\n    переслать сообщение пользователь.id"
};

export function getModuleMeta() {
  return moduleMeta;
}
