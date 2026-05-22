import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "repeat_n_times",
  "name": "Повторить N раз",
  "desc": "Выполнить тело цикла заданное количество раз",
  "category": "🔄 Циклы и итерации",
  "code": "бот \"YOUR_BOT_TOKEN\"\nстарт:\n    ответ \"👋 Добро пожаловать!\"\n    кнопки \"🎲 Бросить 5 кубиков\"\n\nпри нажатии \"🎲 Бросить 5 кубиков\":\n    запомни результаты = \"🎲 Результаты:\n\"\n    повторять 5 раз:\n        запомни бросок = случайное_число(1, 6)\n        запомни результаты = результаты + \"• {бросок}\n\"\n    ответ результаты\n    кнопки \"🔄 Бросить снова\" \"🏠 Главная\""
};

export function getModuleMeta() {
  return moduleMeta;
}
