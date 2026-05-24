/**
 * Per-type payload validation rules (shared by NodeManifest and operation registry).
 */

/** Planner flow-graph aliases → manifest field names. */
function conditionText(props) {
  return String(props?.cond ?? props?.expression ?? '').trim();
}

/** @type {Readonly<Record<string, (props: Record<string, unknown>) => string | null>>} */
export const PAYLOAD_VALIDATION_RULES = Object.freeze({
  message: (props) => (String(props?.text ?? '').trim() ? null : 'Текст сообщения не может быть пустым'),
  reply: (props) => (String(props?.text ?? '').trim() ? null : 'Текст ответа не может быть пустым'),
  command: (props) => (String(props?.cmd ?? '').trim() ? null : 'Укажите команду (без /)'),
  callback: (props) => (
    String(props?.data ?? '').trim() || String(props?.label ?? '').trim()
      ? null
      : 'Укажите callback_data или текст кнопки'
  ),
  condition: (props) => (conditionText(props) ? null : 'Условие не может быть пустым'),
  condition_not: (props) => (conditionText(props) ? null : 'Условие не может быть пустым'),
  ask: (props) => (
    String(props?.question ?? props?.prompt ?? '').trim() ? null : 'Вопрос не может быть пустым'
  ),
  remember: (props) => (String(props?.varname ?? '').trim() ? null : 'Укажите имя переменной'),
  set_variable: (props) => {
    if (!String(props?.name ?? props?.varname ?? '').trim()) return 'Укажите имя переменной';
    return null;
  },
  get_variable: (props) => {
    if (!String(props?.name ?? '').trim()) return 'Укажите имя в ctx.vars';
    return null;
  },
  get: (props) => (String(props?.key ?? '').trim() ? null : 'Укажите ключ хранилища'),
  save: (props) => (String(props?.key ?? '').trim() ? null : 'Укажите ключ хранилища'),
  goto: (props) => (String(props?.target ?? '').trim() ? null : 'Укажите целевой обработчик'),
  loop: (props) => {
    const mode = String(props?.mode ?? 'count').trim();
    if (mode === 'count') {
      const n = Number(props?.count);
      if (!Number.isFinite(n) || n <= 0) return 'Количество итераций должно быть положительным числом';
    } else if (mode === 'while') {
      if (!String(props?.cond ?? '').trim()) return 'Укажите условие цикла';
    }
    return null;
  },
  require_role: (props) => {
    const explicit = String(props?.roles ?? '').trim();
    if (explicit) {
      const parts = explicit.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
      const allowed = new Set(['admin', 'moderator', 'user']);
      for (const p of parts) {
        if (!allowed.has(p.toLowerCase())) {
          return `Неизвестная роль «${p}». Допустимо: admin, moderator, user`;
        }
      }
      return null;
    }
    const role = String(props?.role ?? 'user').trim().toLowerCase();
    if (!['admin', 'moderator', 'user'].includes(role)) {
      return 'Роль должна быть admin, moderator или user';
    }
    return null;
  },
  foreach: (props) => {
    if (!String(props?.list ?? props?.collection ?? '').trim()) {
      return 'Укажите список (list)';
    }
    if (!String(props?.var ?? props?.item ?? '').trim()) {
      return 'Укажите переменную элемента (var)';
    }
    return null;
  },
  bot: (props) => (String(props?.token ?? '').trim() ? null : 'Токен бота обязателен'),
  version: (props) => (String(props?.version ?? '').trim() ? null : 'Укажите версию'),
});
