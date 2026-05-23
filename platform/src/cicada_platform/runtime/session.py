"""User session state — platform-native (no cicada.runtime import)."""

from __future__ import annotations


class UserSession:
    """Per-user FSM context (ported from cicada.runtime.UserContext)."""

    def __init__(
        self,
        chat_id: int,
        username: str = "",
        user_id: int | None = None,
        last_name: str = "",
        globals_dict: dict | None = None,
    ) -> None:
        self.chat_id = chat_id
        self.user_id = user_id or chat_id
        self.vars: dict = {
            "имя": username or str(chat_id),
            "chat_id": str(chat_id),
            "user_id": str(user_id or chat_id),
            "фамилия": last_name,
        }
        self.user_obj = {
            "id": str(user_id or chat_id),
            "имя": username or "",
            "фамилия": last_name,
            "chat_id": str(chat_id),
            "язык": "",
            "фото": "",
        }
        self.chat_obj = {"id": str(chat_id), "тип": "личка"}
        self.scenario: str | None = None
        self.step: int = 0
        self.step_names: dict = {}
        self.waiting_for: str | None = None
        self._globals: dict = globals_dict or {}

    def set_step_names(self, steps: list) -> None:
        self.step_names = {}
        for i, step in enumerate(steps):
            if hasattr(step, "name"):
                self.step_names[step.name] = i

    def get_step_index(self, name: str) -> int:
        return self.step_names.get(name, -1)

    def set(self, name: str, value) -> None:
        self.vars[name] = value

    def get(self, name: str, default=None):
        if name == "пользователь":
            return self.user_obj
        if name == "чат":
            return self.chat_obj
        if name.startswith("пользователь."):
            prop = name.split(".", 1)[1]
            return self.user_obj.get(prop, default)
        if name.startswith("чат."):
            prop = name.split(".", 1)[1]
            return self.chat_obj.get(prop, default)
        if name in self.vars:
            return self.vars[name]
        if name in self._globals:
            return self._globals[name]
        return default

    def resolve(self, part) -> str:
        from cicada.parser import VarRef  # type: ignore[import-untyped]

        if isinstance(part, VarRef):
            return str(self.vars.get(part.name, f"[{part.name}]"))
        return str(part)

    def render(self, parts: list) -> str:
        return "".join(self.resolve(p) for p in parts)


class SessionRuntime:
    """Multi-user session store."""

    def __init__(self, globals_dict: dict | None = None) -> None:
        self._users: dict[int, UserSession] = {}
        self._globals: dict = globals_dict or {}

    def user(
        self,
        chat_id: int,
        username: str = "",
        user_id: int | None = None,
        last_name: str = "",
        *,
        language_code: str = "",
        chat_type: str = "private",
    ) -> UserSession:
        _type_map = {
            "private": "личка",
            "group": "группа",
            "supergroup": "супергруппа",
            "channel": "канал",
        }
        if chat_id not in self._users:
            self._users[chat_id] = UserSession(
                chat_id, username, user_id, last_name, self._globals
            )
        ctx = self._users[chat_id]
        if username:
            ctx.user_obj["имя"] = username
            ctx.user_obj["фамилия"] = last_name
            ctx.vars["имя"] = username
            ctx.vars["фамилия"] = last_name
        if language_code:
            ctx.user_obj["язык"] = language_code
        ctx.chat_obj["тип"] = _type_map.get(chat_type, chat_type)
        return ctx
