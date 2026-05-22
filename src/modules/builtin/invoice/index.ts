import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "invoice",
  "name": "Выставление счёта",
  "desc": "Создание и отправка счёта на оплату",
  "category": "💳 Платежи",
  "code": "бот \"YOUR_BOT_TOKEN\"\nстарт:\n    ответ \"👋 Добро пожаловать!\"\n    кнопки \"💳 Оплатить\"\n\nпри нажатии \"💳 Оплатить\":\n    получить \"итого\" → итого\n    если не итого:\n        ответ \"❌ Сумма заказа не определена\"\n        стоп\n    ответ \"💳 Счёт на оплату\n━━━━━━━━━━\nСумма: {итого}₽\n━━━━━━━━━━\nПосле оплаты нажмите «Я оплатил»\"\n    кнопки \"✅ Я оплатил\" \"❌ Отмена\""
};

export function getModuleMeta() {
  return moduleMeta;
}
