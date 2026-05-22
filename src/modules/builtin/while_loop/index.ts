import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "while_loop",
  "name": "Цикл while (пока условие)",
  "desc": "Цикл с условием — выполняется пока условие истинно",
  "category": "🔄 Циклы и итерации",
  "code": "бот \"YOUR_BOT_TOKEN\"\nстарт:\n    ответ \"👋 Добро пожаловать!\"\n    кнопки \"⏱️ Обратный отсчёт\"\n\nпри нажатии \"⏱️ Обратный отсчёт\":\n    запомни счёт = 5\n    запомни текст = \"⏱️ Отсчёт:\n\"\n    пока счёт > 0:\n        запомни текст = текст + \"{счёт}... \"\n        запомни счёт = счёт - 1\n    ответ текст + \"🚀 Пуск!\"\n    кнопки \"🔄 Снова\" \"🏠 Главная\""
};

export function getModuleMeta() {
  return moduleMeta;
}
