import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "calculator",
  "name": "Калькулятор",
  "desc": "Простой калькулятор для вычислений",
  "category": "📎 Утилиты",
  "code": "бот \"YOUR_BOT_TOKEN\"\nстарт:\n    ответ \"👋 Добро пожаловать!\"\n    кнопки \"🧮 Калькулятор\"\n\nпри нажатии \"🧮 Калькулятор\":\n    спросить \"🧮 Введите выражение (например: 10 + 5):\" → выражение\n    ответ \"🧮 {выражение} = [результат вычисления]\"\n    кнопки \"🔄 Ещё\" \"🏠 Главная\""
};

export function getModuleMeta() {
  return moduleMeta;
}
