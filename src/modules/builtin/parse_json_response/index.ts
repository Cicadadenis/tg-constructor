import type { ModuleDefinition } from '../../types';

export const moduleMeta: ModuleDefinition = {
  "id": "parse_json_response",
  "name": "Разбор JSON-ответа от API",
  "desc": "Парсинг JSON-строки из HTTP-ответа в объект",
  "category": "📁 Файлы и JSON",
  "code": "бот \"YOUR_BOT_TOKEN\"\nстарт:\n    ответ \"👋 Добро пожаловать!\"\n    кнопки \"🌦️ Погода\"\n\nпри нажатии \"🌦️ Погода\":\n    http_get \"https://wttr.in/Moscow?format=j1\" → ответ_json\n    # Разбираем JSON-строку в объект\n    запомни погода = разобрать_json(ответ_json)\n    запомни темп = погода[\"current_condition\"][0][\"temp_C\"]\n    запомни описание = погода[\"current_condition\"][0][\"weatherDesc\"][0][\"value\"]\n    ответ \"🌦️ Погода в Москве:\n🌡️ {темп}°C\n☁️ {описание}\"\n    кнопки \"🔄 Обновить\" \"🏠 Главная\""
};

export function getModuleMeta() {
  return moduleMeta;
}
