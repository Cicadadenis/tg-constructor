import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "captcha",
  "name": "Капча (случайная математика)",
  "desc": "Защита от спам-ботов через случайную математическую задачу",
  "category": "🔐 Доступ и авторизация",
  "code": "бот \"YOUR_BOT_TOKEN\"\n\nстарт:\n    ответ \"👋 Добро пожаловать!\"\n    кнопки \"🏠 Главное меню\"\n    запомни a = случайное_число(1, 9)\n    запомни b = случайное_число(1, 9)\n    запомни answer = a + b\n    сохранить \"captcha_answer\" = answer\n    спросить \"🤖 Докажите что вы человек!\nСколько будет {a} + {b}?\" → user_answer\n\n    получить \"captcha_answer\" → correct\n    если user_answer == correct:\n        ответ \"✅ Верно! Добро пожаловать, {пользователь.имя}!\"\n        кнопки \"🏠 Главное меню\"\n    иначе:\n        ответ \"❌ Неверно. Попробуйте снова.\"\n        стоп\n\nпри нажатии \"🏠 Главное меню\":\n    ответ \"🏠 Главное меню\"\n    кнопки \"🏠 Главное меню\""
};

export function getModuleMeta() {
  return moduleMeta;
}
