"""Expression evaluation — pure compute for effect layer (NO orchestration)."""

from __future__ import annotations

import re
import time
import json as _json
import datetime as _dt
import os as _os
from urllib.parse import quote as _url_quote
from cicada.core import (
    ButtonsEffect, CallbackEvent, CoreEffect, CoreEvent, InlineKeyboardEffect,
    MediaEffect, MediaEvent, MessageEffect, MessageEvent, PlatformEffect,
    RequestsHttpClient, TelegramUpdateNormalizer,
)

from cicada.parser import (
    Program, Reply, RandomReply, Ask, Remember, If,
    Buttons, InlineButton, InlineKeyboard, InlineKeyboardFromList, InlineKeyboardFromDB, Photo, PhotoVar, Sticker,
    GlobalVar,
    StartScenario, Step,
    Condition, VarRef, FunctionCall, ComplexCondition,
    ForwardPhoto, SaveFile,
    SendDocument, SendAudio, SendVideo, SendVoice,
    SendLocation, SendContact, SendPoll, SendInvoice,
    SendGame, SendMarkdown, SendHTML, SendMarkdownV2, DownloadFile,
    EndScenario, ReturnFromScenario, RepeatStep, GotoStep,
    SaveToDB, LoadFromDB,
    HttpGet, HttpPost,
    Log, Sleep,
    TelegramAPI,
    UseBlock,
    # Expression AST
    Literal, Variable, BinaryOp, UnaryOp, Call,
    # Составные типы и коллекции
    ListLiteral, DictLiteral, Index, Attr, ForEach,
    # Новые узлы ядра v2
    WhileLoop, BreakLoop, ContinueLoop, Timeout,
    Notify, Broadcast,
    CheckSubscription, GetChatMemberRole, ForwardMsg,
    LoadJson, ParseJson, SaveJson, DeleteFile, DeleteDictKey, SetDictKey,
    HttpPatch, HttpPut, HttpDelete, SetHttpHeaders, FetchJson,
    DeleteFromDB, GetAllDBKeys, SaveGlobalDB, LoadFromUserDB,
    ReturnValue, CallBlock,
)
from cicada.database import get_db  # storage adapter only

# Runtime: platform session

from cicada.security_utils import (
    decode_callback_data,
    encode_callback_data,
    legacy_callback_hash,
    resolve_path_under_base,
    validate_http_url,
)


# ══════════════════════════════════════════════════════════════════
#  Сигналы управления циклом
# ══════════════════════════════════════════════════════════════════

class LoopBreak(Exception):
    """Signal raised by BreakLoop op; caught by control plane."""


class LoopContinue(Exception):
    """Signal raised by ContinueLoop op; caught by control plane."""


# ══════════════════════════════════════════════════════════════════
#  Исключения с контекстом сценария/шага/строки  (п. 4)
# ══════════════════════════════════════════════════════════════════

class CicadaRuntimeError(Exception):
    """Ошибка времени выполнения с контекстом"""
    def __init__(self, message: str, stmt=None,
                 scenario: str = None, step_name: str = None, line: int = None):
        self.stmt      = stmt
        self.scenario  = scenario
        self.step_name = step_name
        self.line      = line
        super().__init__(self._format(message))

    def _format(self, msg: str) -> str:
        parts = [msg]
        if self.scenario:
            parts.append(f"Сценарий: {self.scenario}")
        if self.step_name:
            parts.append(f"Шаг: {self.step_name}")
        if self.line is not None:
            parts.append(f"Строка: {self.line}")
        return "\n".join(parts)


class CicadaUndefinedVariable(CicadaRuntimeError):
    """Обращение к несуществующей переменной"""
    pass


class CicadaTypeError(CicadaRuntimeError):
    """Несовместимые типы в операции"""
    pass


class CicadaIndexError(CicadaRuntimeError):
    """Выход за пределы списка или несуществующий ключ"""
    pass


# ══════════════════════════════════════════════════════════════════
#  Система типов
# ══════════════════════════════════════════════════════════════════

_NUMERIC        = (int, float)
_ARITHMETIC_OPS = {"-", "*", "/", "//", "%", "**"}
_COMPARE_OPS    = {">", "<", ">=", "<="}


def _cicada_type(val) -> str:
    """Имя типа для сообщений об ошибках."""
    if isinstance(val, bool):   return "логический"
    if isinstance(val, int):    return "целое"
    if isinstance(val, float):  return "дробное"
    if isinstance(val, str):    return "строка"
    if val is None:             return "пусто"
    if isinstance(val, list):   return "список"
    if isinstance(val, dict):   return "объект"
    return type(val).__name__


def _truthy(val) -> bool:
    """
    Единое правило истинности в Cicada:
      False  ->  None, "", 0, 0.0, False, [], {}
      True   ->  всё остальное
    """
    if val is None:               return False
    if val is False:              return False
    if isinstance(val, bool):     return val
    if isinstance(val, _NUMERIC): return val != 0
    if isinstance(val, str):      return val != ""
    if isinstance(val, list):     return len(val) > 0
    if isinstance(val, dict):     return len(val) > 0
    return True


def _to_number(val, op: str, side: str):
    if isinstance(val, bool):
        raise CicadaTypeError(
            f"Операция '{op}': ожидается число, получен логический ({val!r}).\n"
            f"Используйте в_число(переменная) для явного преобразования."
        )
    if isinstance(val, _NUMERIC):
        return val
    if isinstance(val, str):
        s = val.strip()
        try:
            if re.fullmatch(r"-?\d+", s):
                return int(s)
            if re.fullmatch(r"-?\d+\.\d+", s):
                return float(s)
            return float(s)
        except ValueError:
            raise CicadaTypeError(
                f"Операция '{op}': {side} — строка {val!r}, не является числом.\n"
                f"Используйте в_число(переменная) для проверки перед операцией."
            )
    raise CicadaTypeError(
        f"Операция '{op}': {side} имеет тип '{_cicada_type(val)}', ожидается число."
    )


def _coerce_numeric(left, right, op: str):
    l = _to_number(left,  op, "левый операнд")
    r = _to_number(right, op, "правый операнд")
    return l, r


def _auto_cast(value):
    if isinstance(value, str):
        value = value.strip()

        if re.fullmatch(r"-?\d+", value):
            return int(value)

        if re.fullmatch(r"-?\d+\.\d+", value):
            return float(value)

    return value


# ══════════════════════════════════════════════════════════════════
#  п. 6 — Реестр пользовательских функций (плагины / cicada install)
# ══════════════════════════════════════════════════════════════════

_USER_FUNCS: dict = {}   # name -> callable(args: list) -> value


def register_func(name: str, fn) -> None:
    """
    Регистрирует пользовательскую функцию, доступную в DSL.

    Пример:
        def my_discount(args):
            price, pct = float(args[0]), float(args[1])
            return price * (1 - pct / 100)

        register_func("скидка", my_discount)

    После этого в Cicada-сценарии:
        запомни итог = скидка(цена, 10)
    """
    _USER_FUNCS[name] = fn


# ══════════════════════════════════════════════════════════════════
#  Call sandbox
# ══════════════════════════════════════════════════════════════════

_BUILTIN_FUNCS = {
    # строковые
    "содержит", "длина", "начинается_с", "верхний", "нижний",
    "обрезать", "разделить", "соединить",
    # новые строковые
    "заменить", "найти", "срез",
    # типизация
    "число", "тип",
    # явные преобразования
    "в_число", "в_строку", "в_булево",
    # арифметика
    "округлить", "абс", "мин", "макс",
    # случайные числа
    "случайное_число",
    # списки/объекты
    "длина_списка", "добавить", "содержит_элемент", "ключи", "значения", "удалить_ключ",
    # дата/время
    "формат_даты",
    # JSON
    "разобрать_json", "в_json",
    # URL (значения в query string)
    "кодировать_url",
}

_FORBIDDEN_FUNCS = {
    "exec", "eval", "compile", "open", "import",
    "__import__", "getattr", "setattr", "delattr",
}


# ══════════════════════════════════════════════════════════════════
#  Expression Engine
# ══════════════════════════════════════════════════════════════════

def eval_expr(node, ctx, strict: bool = True):
    """Вычисляет узел Expression AST в контексте ctx."""

    if isinstance(node, Literal):
        return node.value

    if isinstance(node, Variable):
        return _get_var(node.name, ctx, strict)

    # п. 1 — составные типы
    if isinstance(node, ListLiteral):
        return [eval_expr(item, ctx, strict) for item in node.items]

    if isinstance(node, DictLiteral):
        out = {}
        for k, v in node.pairs:
            if isinstance(k, Variable):
                key = k.name
            elif isinstance(k, Literal):
                key = str(k.value)
            else:
                key = str(eval_expr(k, ctx, strict))
            out[key] = eval_expr(v, ctx, strict)
        return out

    if isinstance(node, Index):
        target = eval_expr(node.target, ctx, strict)
        key    = eval_expr(node.key,    ctx, strict)
        return _eval_index(target, key)

    if isinstance(node, Attr):
        target = eval_expr(node.target, ctx, strict)
        return _eval_attr(target, node.name)

    if isinstance(node, BinaryOp):
        return _eval_binop(node, ctx, strict)

    if isinstance(node, UnaryOp):
        val = eval_expr(node.operand, ctx, strict)
        if node.op == "не":
            return not _truthy(val)
        if node.op == "-":
            n = _to_number(val, "унарный -", "операнд")
            return -n
        raise CicadaRuntimeError(f"Неизвестный унарный оператор: {node.op!r}")

    if isinstance(node, Call):
        return _eval_call(node, ctx, strict)

    # обратная совместимость
    if isinstance(node, VarRef):
        return _get_var(node.name, ctx, strict)

    if isinstance(node, FunctionCall):
        args = [eval_expr(a, ctx, strict) for a in node.args]
        return _call_builtin(node.name, args)

    if isinstance(node, Condition):
        return _eval_legacy_condition(node, ctx, strict)

    if isinstance(node, ComplexCondition):
        return _eval_legacy_complex(node, ctx, strict)

    if isinstance(node, (str, int, float, bool)):
        return node
    if isinstance(node, (list, dict)):
        return node
    if node is None:
        return None

    raise CicadaRuntimeError(f"Неизвестный тип узла: {type(node).__name__}")


def _eval_index(target, key):
    """список[0] или объект["ключ"] с понятными ошибками."""
    if isinstance(target, list):
        if not isinstance(key, _NUMERIC) or isinstance(key, bool):
            raise CicadaTypeError(
                f"Индекс списка должен быть числом, получен {_cicada_type(key)} ({key!r})."
            )
        idx = int(key)
        if idx < 0 or idx >= len(target):
            raise CicadaIndexError(
                f"Индекс {idx} вне диапазона списка (длина {len(target)}).\n"
                f"         {'~'} ожидалось 0..{len(target)-1}"
            )
        return target[idx]

    if isinstance(target, dict):
        str_key = str(key)
        if str_key not in target:
            available = ", ".join(f'"{k}"' for k in target.keys())
            raise CicadaIndexError(
                f"Ключ {str_key!r} не найден в объекте.\n"
                f"Доступные ключи: {available}"
            )
        return target[str_key]

    raise CicadaTypeError(
        f"Индексирование недоступно для типа '{_cicada_type(target)}'."
    )


def _format_template_scalar(val) -> str:
    if val is None:
        return ""
    if isinstance(val, bool):
        return "истина" if val else "ложь"
    if isinstance(val, float) and val.is_integer():
        return str(int(val))
    return str(val)


def render_item_template(template: str, item) -> str:
    """Подстановка {item} и {item.field} в шаблоны inline-кнопок."""
    if not template or "{" not in template:
        return template

    def repl(m: re.Match) -> str:
        path = m.group(1).strip()
        if path == "item":
            return _format_template_scalar(item)
        if path.startswith("item."):
            cur = item
            for part in path.split(".")[1:]:
                if isinstance(cur, dict):
                    cur = cur.get(part)
                else:
                    cur = None
                    break
            return _format_template_scalar(cur)
        return m.group(0)

    return re.sub(r"\{([^}]+)\}", repl, template)


def _eval_attr(target, name: str):
    """объект.поле — синтаксический сахар над dict-доступом."""
    if isinstance(target, dict):
        if name not in target:
            available = ", ".join(target.keys())
            raise CicadaIndexError(
                f"Поле '{name}' не найдено в объекте.\n"
                f"Доступные поля: {available}"
            )
        return target[name]
    raise CicadaTypeError(
        f"Доступ к полю '{name}' недоступен для типа '{_cicada_type(target)}'."
    )


def _get_var(name: str, ctx, strict: bool):
    # В шаблонах пользователи часто пишут переменные как {логин}.
    # Обычно парсер раскрывает такие шаблоны заранее, но старые AST-узлы
    # (например, VarRef из fallback-парсера условий) могут донести имя вместе
    # с фигурными скобками до runtime. Нормализуем его здесь, чтобы {логин}
    # ссылался на уже сохранённую переменную логин, а не считался отдельным именем.
    if isinstance(name, str):
        raw_name = name.strip()
        if raw_name.startswith("{") and raw_name.endswith("}"):
            inner_name = raw_name[1:-1].strip()
            if inner_name:
                name = inner_name

    # Встроенные динамические переменные
    if name == "текущая_дата":
        return _dt.datetime.now().strftime("%d.%m.%Y")
    if name == "текущее_время":
        return _dt.datetime.now().strftime("%H:%M:%S")
    if name == "текущий_timestamp":
        return int(_dt.datetime.now().timestamp())

    # Системные объекты для Attr: пользователь.имя, чат.id
    if name == "пользователь":
        return ctx.user_obj
    if name == "чат":
        return ctx.chat_obj

    val = ctx.get(name)
    if name in ctx.vars or name in ctx._globals:
        return val
    if name.startswith("пользователь.") or name.startswith("чат."):
        return val

    # Доступ через точку для пользовательских переменных: объект.поле
    if "." in name:
        parts = name.split(".", 1)
        obj_name, prop = parts
        obj = ctx.get(obj_name)
        if isinstance(obj, dict):
            if prop == "ключи":
                return list(obj.keys())
            if prop == "значения":
                return list(obj.values())
            if prop == "длина":
                return len(obj)
            if prop in obj:
                return obj[prop]
        if isinstance(obj, list):
            if prop == "длина":
                return len(obj)
        if obj is not None:
            return obj  # объект не dict — вернём как есть
        # не нашли объект — упадём ниже на strict-проверку

    if strict:
        available = ", ".join(sorted(ctx.vars.keys())) or "(нет переменных)"
        raise CicadaUndefinedVariable(
            f"Переменная '{name}' не определена.\n"
            f"Доступные: {available}"
        )
    return ""


def _eval_binop(node: BinaryOp, ctx, strict: bool):
    op = node.op

    if op == "или":
        left = eval_expr(node.left, ctx, strict)
        return left if _truthy(left) else eval_expr(node.right, ctx, strict)
    if op == "и":
        left = eval_expr(node.left, ctx, strict)
        return left if not _truthy(left) else eval_expr(node.right, ctx, strict)

    left  = eval_expr(node.left,  ctx, strict)
    right = eval_expr(node.right, ctx, strict)

    if op == "+":
        if isinstance(left, bool) or isinstance(right, bool):
            raise CicadaTypeError(
                f"Операция '+': нельзя складывать логическое значение.\n"
                f"Получено: {left!r} + {right!r}"
            )
        if isinstance(left, _NUMERIC) and isinstance(right, _NUMERIC):
            return left + right
        if isinstance(left, str) or isinstance(right, str):
            l_str = "" if left  is None else str(left)
            r_str = "" if right is None else str(right)
            return l_str + r_str
        if isinstance(left, _NUMERIC) and isinstance(right, str):
            try:    return left + float(right)
            except ValueError: return str(left) + right
        if isinstance(left, str) and isinstance(right, _NUMERIC):
            try:    return float(left) + right
            except ValueError: return left + str(right)
        return str(left) + str(right)

    if op == "содержит":
        return str(right).lower() in str(left).lower()
    if op == "начинается_с":
        return str(left).lower().startswith(str(right).lower())
    if op == "в":
        if isinstance(right, dict):
            return str(left) in right
        if isinstance(right, (list, str)):
            return left in right
        raise CicadaTypeError(
            f"Оператор 'в': ожидается список, объект или строка, "
            f"получен '{_cicada_type(right)}'."
        )

    if op == "==":
        return _cicada_eq(left, right)
    if op == "!=":
        return not _cicada_eq(left, right)

    if op in _ARITHMETIC_OPS:
        l, r = _coerce_numeric(left, right, op)
        if op == "-":  return l - r
        if op == "*":  return l * r
        if op == "/":
            if r == 0: raise CicadaRuntimeError("Деление на ноль")
            q = l / r
            if isinstance(q, float) and q.is_integer():
                return int(q)
            return q
        if op == "//":
            if r == 0: raise CicadaRuntimeError("Целочисленное деление на ноль")
            return int(l // r)
        if op == "%":  return l % r
        if op == "**": return l ** r

    if op in _COMPARE_OPS:
        l, r = _coerce_numeric(left, right, op)
        if op == ">":  return l > r
        if op == "<":  return l < r
        if op == ">=": return l >= r
        if op == "<=": return l <= r

    raise CicadaRuntimeError(f"Неизвестный оператор: {op!r}")


def _cicada_eq(left, right) -> bool:
    if left is None and right is None:  return True
    if left is None or right is None:   return False
    if isinstance(left, _NUMERIC) and not isinstance(left, bool) \
       and isinstance(right, _NUMERIC) and not isinstance(right, bool):
        return left == right
    if isinstance(left, _NUMERIC) and isinstance(right, str):
        try:   return float(left) == float(right)
        except ValueError: return False
    if isinstance(left, str) and isinstance(right, _NUMERIC):
        try:   return float(left) == float(right)
        except ValueError: return False
    return str(left).lower() == str(right).lower()


def _eval_call(node: Call, ctx, strict: bool):
    """
    Порядок поиска (п. 6):
      1. _FORBIDDEN_FUNCS  — немедленная ошибка
      2. _BUILTIN_FUNCS    — встроенные
      3. _USER_FUNCS       — пользовательские (плагины)
      4. ошибка
    """
    name = node.name

    if name in _FORBIDDEN_FUNCS:
        raise CicadaRuntimeError(
            f"Функция '{name}' запрещена по соображениям безопасности."
        )

    args = [eval_expr(a, ctx, strict) for a in node.args]

    if name in _BUILTIN_FUNCS:
        return _call_builtin(name, args)

    if name in _USER_FUNCS:
        try:
            return _USER_FUNCS[name](args)
        except CicadaRuntimeError:
            raise
        except Exception as e:
            raise CicadaRuntimeError(
                f"Ошибка в пользовательской функции '{name}': {e}"
            )

    available_all = sorted(_BUILTIN_FUNCS | set(_USER_FUNCS.keys()))
    raise CicadaRuntimeError(
        f"Неизвестная функция '{name}'.\n"
        f"Доступные: {', '.join(available_all)}"
    )


def _call_builtin(name: str, args: list):
    """Реализация встроенных функций."""

    # строковые
    if name == "содержит":
        return len(args) >= 2 and str(args[1]).lower() in str(args[0]).lower()
    if name == "длина":
        v = args[0] if args else ""
        return len(v) if isinstance(v, (str, list, dict)) else len(str(v))
    if name == "начинается_с":
        return len(args) >= 2 and str(args[0]).lower().startswith(str(args[1]).lower())
    if name == "верхний":
        return str(args[0]).upper() if args else ""
    if name == "нижний":
        return str(args[0]).lower() if args else ""
    if name == "обрезать":
        return str(args[0]).strip() if args else ""
    if name == "разделить":
        s   = str(args[0]) if args else ""
        sep = str(args[1]) if len(args) > 1 else " "
        return s.split(sep)
    if name == "соединить":
        sep   = str(args[0]) if args else ""
        items = args[1] if len(args) > 1 else []
        return sep.join(str(i) for i in (items if isinstance(items, list) else [items]))

    # типизация — старые
    if name == "число":
        try:   float(str(args[0])); return True
        except (ValueError, IndexError): return False
    if name == "тип":
        return _cicada_type(args[0]) if args else "пусто"

    # п. 3: явные функции преобразования
    if name == "число":
        name = "в_число"
    if name == "в_число":
        if not args:
            raise CicadaTypeError("в_число(): нужен хотя бы один аргумент.")
        v = args[0]
        if isinstance(v, bool):     return 1 if v else 0
        if isinstance(v, _NUMERIC): return v
        if isinstance(v, str):
            s = v.strip()
            try:
                if re.fullmatch(r"-?\d+", s):
                    return int(s)
                if re.fullmatch(r"-?\d+\.\d+", s):
                    return float(s)
                return float(s)
            except ValueError:
                raise CicadaTypeError(
                    f"в_число(): не удаётся преобразовать {v!r} в число."
                )
        raise CicadaTypeError(
            f"в_число(): тип '{_cicada_type(v)}' не поддерживается."
        )

    if name == "в_строку":
        if not args: return ""
        v = args[0]
        return "" if v is None else str(v)

    if name == "в_булево":
        if not args: return False
        return _truthy(args[0])

    # арифметика
    if name == "округлить":
        n = _to_number(args[0] if args else 0, "округлить", "аргумент")
        digits = int(args[1]) if len(args) > 1 else 0
        return round(n, digits) if digits else int(round(n))
    if name == "абс":
        n = _to_number(args[0] if args else 0, "абс", "аргумент")
        return abs(n)
    if name == "мин":
        nums = [_to_number(a, "мин", f"аргумент {i+1}") for i, a in enumerate(args)]
        return min(nums) if nums else None
    if name == "макс":
        nums = [_to_number(a, "макс", f"аргумент {i+1}") for i, a in enumerate(args)]
        return max(nums) if nums else None

    # п. 1: списковые/объектные вспомогательные функции
    if name == "длина_списка":
        v = args[0] if args else []
        if isinstance(v, (list, dict, str)): return len(v)
        raise CicadaTypeError(
            f"длина_списка(): ожидается список/объект/строка, получен '{_cicada_type(v)}'."
        )
    if name == "добавить":
        if len(args) < 2 or not isinstance(args[0], list):
            raise CicadaTypeError("добавить(список, элемент): первый аргумент — список.")
        return args[0] + [args[1]]
    if name == "содержит_элемент":
        if len(args) < 2: return False
        lst, item = args[0], args[1]
        if isinstance(lst, list): return item in lst
        if isinstance(lst, dict): return str(item) in lst
        return str(item) in str(lst)
    if name == "ключи":
        if not args or not isinstance(args[0], dict):
            raise CicadaTypeError("ключи(): ожидается объект.")
        return list(args[0].keys())
    if name == "значения":
        if not args or not isinstance(args[0], dict):
            raise CicadaTypeError("значения(): ожидается объект.")
        return list(args[0].values())

    if name == "удалить_ключ":
        if len(args) < 2 or not isinstance(args[0], dict):
            raise CicadaTypeError("удалить_ключ(объект, ключ): первый аргумент — объект.")
        result = dict(args[0])
        result.pop(str(args[1]), None)
        return result

    # ── Строковые операции ──────────────────────────────────────────────

    if name == "заменить":
        if len(args) < 3:
            raise CicadaTypeError("заменить(строка, что, чем): нужно 3 аргумента.")
        return str(args[0]).replace(str(args[1]), str(args[2]))

    if name == "найти":
        if len(args) < 2:
            raise CicadaTypeError("найти(строка, подстрока): нужно 2 аргумента.")
        return str(args[0]).find(str(args[1]))

    if name == "срез":
        if not args:
            raise CicadaTypeError("срез(строка/список, от, до): нужен хотя бы 1 аргумент.")
        s = args[0]
        start = int(args[1]) if len(args) > 1 else 0
        end   = int(args[2]) if len(args) > 2 else (len(s) if isinstance(s, (str, list)) else 0)
        if isinstance(s, (str, list)):
            return s[start:end]
        return str(s)[start:end]

    # ── Случайные числа ────────────────────────────────────────────────

    if name == "случайное_число":
        import random as _rand
        a = int(args[0]) if args else 0
        b = int(args[1]) if len(args) > 1 else 100
        return _rand.randint(a, b)

    # ── Дата/время ─────────────────────────────────────────────────────

    if name == "формат_даты":
        date_val = str(args[0]) if args else ""
        fmt      = str(args[1]) if len(args) > 1 else "DD.MM.YYYY"
        # Преобразуем маску в strftime
        fmt_py = (fmt
                  .replace("YYYY", "%Y").replace("YY", "%y")
                  .replace("MM", "%m").replace("DD", "%d")
                  .replace("HH", "%H").replace("mm", "%M").replace("SS", "%S"))
        for parse_fmt in ["%d.%m.%Y", "%Y-%m-%d", "%d/%m/%Y", "%Y.%m.%d",
                          "%d.%m.%Y %H:%M:%S", "%Y-%m-%d %H:%M:%S"]:
            try:
                dt = _dt.datetime.strptime(date_val, parse_fmt)
                return dt.strftime(fmt_py)
            except ValueError:
                continue
        return date_val  # fallback

    # ── JSON ────────────────────────────────────────────────────────────

    if name == "разобрать_json":
        s = str(args[0]) if args else "{}"
        try:
            return _json.loads(s)
        except _json.JSONDecodeError as e:
            raise CicadaRuntimeError(f"разобрать_json(): ошибка разбора: {e}")

    if name == "в_json":
        v = args[0] if args else {}
        try:
            return _json.dumps(v, ensure_ascii=False)
        except TypeError as e:
            raise CicadaRuntimeError(f"в_json(): не удаётся сериализовать: {e}")

    # ── URL ────────────────────────────────────────────────────────────

    if name == "кодировать_url":
        if not args:
            return ""
        # Полное кодирование для подстановки в ?data=… (пробелы, &, кириллица)
        return _url_quote(str(args[0]), safe="")

    raise CicadaRuntimeError(f"Неизвестная функция: '{name}'")


def _eval_legacy_condition(cond: Condition, ctx, strict: bool) -> bool:
    left  = eval_expr(cond.left, ctx, strict)
    right = eval_expr(cond.right, ctx, strict)
    op    = cond.op
    result = _eval_binop(BinaryOp(Literal(left), op, Literal(right)), ctx, strict)
    if not isinstance(result, bool):
        result = _truthy(result)
    return not result if cond.negate else result


def _eval_legacy_complex(cond: ComplexCondition, ctx, strict: bool) -> bool:
    results = [_eval_legacy_condition(c, ctx, strict) for c in cond.conditions]
    result  = results[0]
    for i, op in enumerate(cond.operators):
        if op == "и":    result = result and results[i + 1]
        elif op == "или": result = result or results[i + 1]
    return result


def is_truthy(val) -> bool:
    return _truthy(val)


def enrich_error(err: CicadaRuntimeError, ctx=None) -> CicadaRuntimeError:
    if ctx and getattr(ctx, "current_node_id", None) and not err.step_name:
        err.step_name = str(ctx.current_node_id)
    return err

