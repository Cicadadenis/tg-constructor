import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "qr_generator",
  "name": "QR-код генератор",
  "desc": "Рабочий QR-модуль с FSM (без перезаписи токена)",
  "category": "📎 Утилиты",
  "code": "бот \"YOUR_BOT_TOKEN\"\n\nпри старте:\n    ответ \"Привет, {пользователь.имя}!\"\n    кнопки \"📷 QR-код\" \"🔄 Создать ещё\" \"🏠 Главная\"\n\nпри нажатии \"📷 QR-код\":\n    запустить qr_сценарий\n\n    кнопки \"📷 QR-код\" \"🔄 Создать ещё\" \"🏠 Главная\"\nпри нажатии \"🔄 Создать ещё\":\n    запустить qr_сценарий\n\n    кнопки \"📷 QR-код\" \"🔄 Создать ещё\" \"🏠 Главная\"\nпри нажатии \"🏠 Главная\":\n    ответ \"Главное меню\"\n    кнопки \"📷 QR-код\"\n\nсценарий qr_сценарий:\n    шаг ввод:\n        спросить \"Введите текст или ссылку для QR-кода:\" → qr_text\n\n    шаг ответ:\n        сохранить \"qr_text\" = qr_text\n        ответ \"📷 Ваш QR-код: https://api.qrserver.com/v1/create-qr-code/?size=300x300&data={кодировать_url(qr_text)}\"\n        кнопки \"🔄 Создать ещё\" \"🏠 Главная\"\n        завершить сценарий"
};

export function getModuleMeta() {
  return moduleMeta;
}
