import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "current_datetime",
  "name": "Текущая дата и время",
  "desc": "Встроенные переменные текущей даты, времени и timestamp",
  "category": "🕐 Дата и время",
  "code": "бот \"YOUR_BOT_TOKEN\"\nстарт:\n    ответ \"👋 Добро пожаловать!\"\n    кнопки \"📅 Дата и время\"\n\nпри нажатии \"📅 Дата и время\":\n    ответ \"📅 Дата: {текущая_дата}\n🕐 Время: {текущее_время}\n🔢 Timestamp: {текущий_timestamp}\"\n    кнопки \"🔄 Обновить\" \"🏠 Главная\""
};

export function getModuleMeta() {
  return moduleMeta;
}
