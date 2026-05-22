import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "timeout_exec",
  "name": "Выполнение с таймаутом",
  "desc": "Ограничение времени на выполнение блока (например, внешний API-запрос)",
  "category": "🔄 Циклы и итерации",
  "code": "бот \"YOUR_BOT_TOKEN\"\nстарт:\n    ответ \"👋 Добро пожаловать!\"\n    кнопки \"🌐 Запрос с таймаутом\"\n\nпри нажатии \"🌐 Запрос с таймаутом\":\n    ответ \"⏳ Выполняю запрос (макс. 5 сек)...\"\n    таймаут 5 секунд:\n        http_get \"https://api.example.com/slow-endpoint\" → результат\n        ответ \"✅ Данные получены: {результат}\"\n    # Если таймаут истёк — выполнение продолжается здесь\n    кнопки \"🔄 Попробовать снова\" \"🏠 Главная\""
};

export function getModuleMeta() {
  return moduleMeta;
}
