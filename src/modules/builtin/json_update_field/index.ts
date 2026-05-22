import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "json_update_field",
  "name": "Обновить поле в БД",
  "desc": "Изменяет конкретное поле в БД без потери остальных данных",
  "category": "🗄️ JSON-хранилище (per-user)",
  "code": "бот \"YOUR_BOT_TOKEN\"\nстарт:\n    ответ \"👋 Добро пожаловать!\"\n    кнопки \"✏️ Изменить город\"\n\nпри нажатии \"✏️ Изменить город\":\n    спросить \"🏙 Введите новый город:\" → новый_город\n    сохранить \"профиль_город\" = новый_город\n    ответ \"✅ Город обновлён: {новый_город}\"\n    кнопки \"📋 Мои данные\" \"🏠 Главная\""
};

export function getModuleMeta() {
  return moduleMeta;
}
