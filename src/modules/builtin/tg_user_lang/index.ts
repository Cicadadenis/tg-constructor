import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "tg_user_lang",
  "name": "Язык пользователя из Telegram",
  "desc": "Автоопределение языка интерфейса пользователя в Telegram",
  "category": "📡 Telegram расширения",
  "code": "бот \"YOUR_BOT_TOKEN\"\n\nстарт:\n    получить \"язык\" → сохранённый_язык\n    если не сохранённый_язык:\n        # Используем язык из настроек Telegram пользователя\n        если пользователь.язык == \"ru\":\n            сохранить \"язык\" = \"ru\"\n            ответ \"👋 Привет! Я определил ваш язык автоматически: Русский\"\n        иначе:\n            если пользователь.язык начинается_с \"en\":\n                сохранить \"язык\" = \"en\"\n                ответ \"👋 Hello! I detected your language automatically: English\"\n            иначе:\n                ответ \"🌍 Ваш язык Telegram: {пользователь.язык}\nChoose language:\"\n                кнопки \"🇷🇺 Русский\" \"🇬🇧 English\"\n    кнопки \"📋 Меню\""
};

export function getModuleMeta() {
  return moduleMeta;
}
