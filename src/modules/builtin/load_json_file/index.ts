import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "load_json_file",
  "name": "Загрузка JSON-файла",
  "desc": "Читает JSON-файл с диска в переменную",
  "category": "📁 Файлы и JSON",
  "code": "бот \"YOUR_BOT_TOKEN\"\nстарт:\n    ответ \"👋 Добро пожаловать!\"\n    кнопки \"📂 Загрузить конфиг\" \"📂 Загрузить товары\"\n\nпри нажатии \"📂 Загрузить конфиг\":\n    json_файл \"config.json\" → конфиг\n    ответ \"✅ Конфиг загружен:\nНазвание: {конфиг.название}\nВерсия: {конфиг.версия}\"\n    кнопки \"🏠 Главная\"\n\nпри нажатии \"📂 Загрузить товары\":\n    json_файл \"products.json\" → товары\n    запомни кол = длина_списка(товары)\n    ответ \"📦 Загружено товаров: {кол}\"\n    кнопки \"📋 Показать\" \"🏠 Главная\""
};

export function getModuleMeta() {
  return moduleMeta;
}
