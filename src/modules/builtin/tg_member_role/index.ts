import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "tg_member_role",
  "name": "Роль участника в группе/канале",
  "desc": "Получает статус пользователя в чате: creator/admin/member/left",
  "category": "📡 Telegram расширения",
  "code": "бот \"YOUR_BOT_TOKEN\"\nстарт:\n    ответ \"👋 Добро пожаловать!\"\n    кнопки \"👮 Моя роль\"\n\nпри нажатии \"👮 Моя роль\":\n    роль @your_channel пользователь.id → моя_роль\n    если моя_роль == \"creator\":\n        ответ \"👑 Вы создатель канала!\"\n    иначе:\n        если моя_роль == \"administrator\":\n            ответ \"⚙️ Вы администратор канала\"\n        иначе:\n            если моя_роль == \"member\":\n                ответ \"👤 Вы участник канала\"\n            иначе:\n                ответ \"👻 Вы не участник канала (статус: {моя_роль})\"\n    кнопки \"🏠 Главная\""
};

export function getModuleMeta() {
  return moduleMeta;
}
