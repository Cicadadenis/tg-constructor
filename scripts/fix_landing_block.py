# -*- coding: utf-8 -*-
"""Replace known landing-page strings in App.jsx (incl. half-corrupted)."""
from pathlib import Path

APP = Path("src/App.jsx")
text = APP.read_text(encoding="utf-8")

REPLACEMENTS = [
    (">РќР°С‡Р°ть Р±РµСЃРїР»Р°тно в†'</button>", ">Начать бесплатно →</button>"),
    (">РќР°С‡Р°ть Р±РµСЃРїР»Р°тно</button>", ">Начать бесплатно</button>"),
    (">РќР°С‡Р°ть Р±РµСЃРїР»Р°тно в†'</button>", ">Начать бесплатно →</button>"),
    (">✨ Studio для Telegram-ботов</div>", None),  # skip
    (">РњРѕР№ Бот</span>", ">Мой Бот</span>"),
    (">в—Џ РћРїСѓР±Р»РёРєРѕРІР°н</span>", ">● Опубликован</span>"),
    (">рџ”Ќ РўРµСЃС‚РёСЂРѕРІР°ть</span>", ">🔍 Тестировать</span>"),
    (">РћРїСѓР±Р»РёРєРѕРІР°ть</button>", ">Опубликовать</button>"),
    (">Р—Р°пусти Р±РѕС‚Р° Р·Р° 4 С€Р°РіР°</h2>", ">Запусти бота за 4 шага</h2>"),
    (
        ">РќР°С‡ни Р±РµСЃРїР»Р°тно и РјР°СЃС€С‚Р°Р±РёСЂСѓР№ся по РјРµСЂРµ СЂРѕСЃС‚Р°.</p>",
        ">Начни бесплатно и масштабируйся по мере роста.</p>",
    ),
    (">РќР°РІСЃРµРіРґР° Р±РµСЃРїР»Р°тно</div>", ">Навсегда бесплатно</div>"),
    ("['Приветствие','Сообщение','💬']", None),
    ("['Приветствие','РЎРѕРѕР±С‰РµРЅРёРµ','💬']", "['Приветствие','Сообщение','💬']"),
    (
        "['🧩','Р“РѕС‚РѕРІС‹Рµ РјРѕРґСѓР»Рё','Р‘РёР±Р»РёРѕС‚РµРєР° Р±Р»РѕРєРѕРІ РґР»СЏ Р»СЋР±С‹С… Р·Р°РґР°С‡','#60a5fa']",
        "['🧩','Готовые модули','Библиотека блоков для любых задач','#60a5fa']",
    ),
    ("Р—Р°РіСЂСѓР·РєР° Р°дминки...", "Загрузка админки..."),
]

# Also fix via cp1251 any remaining pure mojibake substrings
from fix_app_encoding import fix_text, has_mojibake

for old, new in REPLACEMENTS:
    if new is None:
        continue
    if old in text:
        text = text.replace(old, new)

# Lines that still contain mojibake markers — try whole-line cp1251
lines = text.splitlines(keepends=True)
out = []
for line in lines:
    if has_mojibake(line) and "import " not in line and "from " not in line:
        try:
            fixed_line = line.encode("cp1251").decode("utf-8")
            if "\ufffd" not in fixed_line:
                line = fixed_line
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
    out.append(line)
text = "".join(out)

APP.write_text(text, encoding="utf-8")
print("landing block patched")
