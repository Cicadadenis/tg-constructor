import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "http_delete",
  "name": "HTTP DELETE — удаление",
  "desc": "Удаляет ресурс через DELETE-запрос",
  "category": "🌐 HTTP и внешние API",
  "code": "бот \"YOUR_BOT_TOKEN\"\nстарт:\n    ответ \"👋 Добро пожаловать!\"\n    кнопки \"🗑️ Удалить запись в API\" \"✅ Да, удалить\"\n\nпри нажатии \"🗑️ Удалить запись в API\":\n    спросить \"Введите ID записи для удаления:\" → record_id\n    ответ \"⚠️ Удалить запись №{record_id}?\"\n    кнопки \"✅ Да, удалить\" \"❌ Отмена\"\n\nпри нажатии \"✅ Да, удалить\":\n    получить \"текущий_record_id\" → record_id\n    http_delete \"https://api.example.com/posts/{record_id}\" → ответ\n    ответ \"✅ Запись удалена из API\"\n    кнопки \"🏠 Главная\""
};

export function getModuleMeta() {
  return moduleMeta;
}
