import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "tg_check_sub",
  "name": "Проверка подписки на канал",
  "desc": "Проверяет подписку через getChatMember API",
  "category": "📡 Telegram расширения",
  "code": "бот \"YOUR_BOT_TOKEN\"\n\nглобально CHANNEL = \"@your_channel\"\n\nблок требовать_подписку:\n    проверить подписку @your_channel → подписан\n    если не подписан:\n        ответ \"📢 Для доступа подпишитесь на канал {CHANNEL}\"\n        кнопки \"✅ Я подписался\"\n        стоп\n\nстарт:\n    использовать требовать_подписку\n    ответ \"✅ Добро пожаловать, {пользователь.имя}!\"\n    кнопки \"📋 Меню\" \"✅ Я подписался\"\n\nпри нажатии \"✅ Я подписался\":\n    использовать требовать_подписку\n    ответ \"🎉 Отлично! Теперь у вас есть доступ.\"\n    кнопки \"📋 Меню\""
};

export function getModuleMeta() {
  return moduleMeta;
}
