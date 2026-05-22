import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "new_user_check",
  "name": "Новый/существующий пользователь при старте",
  "desc": "Разное приветствие для новых и вернувшихся пользователей",
  "category": "👤 Регистрация и профиль",
  "code": "бот \"YOUR_BOT_TOKEN\"\n\nстарт:\n    ответ \"👋 Добро пожаловать!\"\n    кнопки \"📋 Меню\" \"📝 Зарегистрироваться\"\n    получить \"registered\" → registered\n    если registered == \"да\":\n        получить \"user_name\" → user_name\n        ответ \"👋 С возвращением, {user_name}!\"\n        кнопки \"📋 Меню\"\n    иначе:\n        ответ \"🎉 Добро пожаловать! Вы здесь впервые.\"\n        кнопки \"📝 Зарегистрироваться\"\n\nпри нажатии \"📝 Зарегистрироваться\":\n    перейти \"регистрация\"\n\nсценарий регистрация:\n    шаг имя:\n        спросить \"Как вас зовут?\" → user_name\n    шаг финал:\n        сохранить \"registered\" = \"да\"\n        сохранить \"user_name\" = user_name\n        ответ \"✅ Регистрация завершена! Привет, {user_name}!\"\n        кнопки \"📋 Меню\"\n        стоп"
};

export function getModuleMeta() {
  return moduleMeta;
}
