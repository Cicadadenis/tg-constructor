import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "change_language",
  "name": "Смена языка в профиле",
  "desc": "Кнопка смены языка в настройках профиля",
  "category": "🌍 Мультиязычность",
  "code": "бот \"YOUR_BOT_TOKEN\"\nстарт:\n    ответ \"👋 Добро пожаловать!\"\n    кнопки \"🌍 Язык / Language\" \"🇷🇺 Русский\" \"🇬🇧 English\"\n\nпри нажатии \"🌍 Язык / Language\":\n    ответ \"🌍 Choose language / Выберите язык:\"\n    кнопки \"🇷🇺 Русский\" \"🇬🇧 English\"\n\nпри нажатии \"🇷🇺 Русский\":\n    сохранить \"язык\" = \"ru\"\n    ответ \"✅ Язык изменён на Русский\"\n    кнопки \"⚙️ Настройки\" \"🏠 Главная\"\n\nпри нажатии \"🇬🇧 English\":\n    сохранить \"язык\" = \"en\"\n    ответ \"✅ Language changed to English\"\n    кнопки \"⚙️ Settings\" \"🏠 Main\""
};

export function getModuleMeta() {
  return moduleMeta;
}
