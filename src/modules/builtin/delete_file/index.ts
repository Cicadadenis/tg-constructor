import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "delete_file",
  "name": "Удаление файла",
  "desc": "Удаляет временный файл после использования",
  "category": "📁 Файлы и JSON",
  "code": "бот \"YOUR_BOT_TOKEN\"\nстарт:\n    ответ \"👋 Добро пожаловать!\"\n    кнопки \"🗑️ Очистить кэш\"\n\nпри нажатии \"🗑️ Очистить кэш\":\n    запомни файл = \"cache_{пользователь.id}.json\"\n    удалить_файл файл\n    ответ \"🗑️ Временный файл удалён.\"\n    кнопки \"🏠 Главная\""
};

export function getModuleMeta() {
  return moduleMeta;
}
