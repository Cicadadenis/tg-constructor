import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "one_time_code",
  "name": "Одноразовый код доступа",
  "desc": "Выдаёт доступ по одноразовому коду",
  "category": "🔐 Доступ и авторизация",
  "code": "бот \"YOUR_BOT_TOKEN\"\nстарт:\n    ответ \"👋 Добро пожаловать!\"\n    кнопки \"🏠 Главное меню\"\n\nглобально ACCESS_CODE = \"CICADA2024\"\n\nкоманда \"/start\":\n    получить \"activated\" → activated\n    если activated == \"да\":\n        ответ \"✅ Ваш аккаунт уже активирован!\"\n        кнопки \"🏠 Главное меню\"\n        стоп\n    спросить \"🔑 Введите код доступа:\" → code\n\n    если code == ACCESS_CODE:\n        сохранить \"activated\" = \"да\"\n        ответ \"🎉 Код принят! Добро пожаловать.\"\n        кнопки \"🏠 Главное меню\"\n    иначе:\n        ответ \"❌ Неверный код. Попробуйте снова.\"\n\nпри нажатии \"🏠 Главное меню\":\n    ответ \"🏠 Вы в главном меню\"\n    кнопки \"🏠 Главное меню\""
};

export function getModuleMeta() {
  return moduleMeta;
}
