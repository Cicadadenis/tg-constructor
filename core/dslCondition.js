/** Shared helpers for «Если» / «Если не» DSL conditions (studio layer). */

export const DSL_COMPARE_OPS = Object.freeze([
  '==', '!=', '>=', '<=', '>', '<', 'содержит', 'начинается_с', 'в',
]);

export function isConditionLikeType(type) {
  return type === 'condition' || type === 'condition_not';
}

/**
 * Добавляет недостающие `)` / `]` в условии (частая ошибка: `если начинается_с(кнопка, "cat:":`).
 * @param {string} cond
 * @returns {string}
 */
export function balanceConditionParens(cond) {
  const body = String(cond || '').trim().replace(/:+\s*$/, '');
  if (!body) return body;
  let inStr = null;
  let depthParen = 0;
  let depthBracket = 0;
  for (let i = 0; i < body.length; i += 1) {
    const c = body[i];
    if (inStr) {
      if (c === inStr && body[i - 1] !== '\\') inStr = null;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = c;
      continue;
    }
    if (c === '(') depthParen += 1;
    else if (c === ')') depthParen = Math.max(0, depthParen - 1);
    else if (c === '[') depthBracket += 1;
    else if (c === ']') depthBracket = Math.max(0, depthBracket - 1);
  }
  let out = body;
  if (depthParen > 0) out += ')'.repeat(depthParen);
  if (depthBracket > 0) out += ']'.repeat(depthBracket);
  return out;
}

/** `текст == "да"` → `текст не == "да"` */
export function negateConditionForDsl(cond) {
  const raw = String(cond || '').trim();
  if (!raw) return raw;
  for (const op of DSL_COMPARE_OPS) {
    const needle = ` ${op} `;
    const idx = raw.indexOf(needle);
    if (idx >= 0) {
      const left = raw.slice(0, idx).trimEnd();
      const right = raw.slice(idx + needle.length).trimStart();
      if (/\sне\s*$/u.test(left)) return raw;
      return `${left} не ${op} ${right}`;
    }
  }
  if (/^\s*не\s+/iu.test(raw)) return raw;
  return `не ${raw}`;
}

/**
 * Из строки «если УСЛОВИЕ:» извлекает УСЛОВИЕ.
 * Двоеточие внутри строк (например "cat:") не считается концом условия.
 */
export function extractIfConditionFromLine(line) {
  const stripped = String(line || '').trim();
  if (!stripped.startsWith('если ')) return null;
  const body = stripped.slice(5);
  let inStr = null;
  let depthParen = 0;
  let depthBracket = 0;
  for (let i = 0; i < body.length; i += 1) {
    const c = body[i];
    if (inStr) {
      if (c === inStr && body[i - 1] !== '\\') inStr = null;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = c;
      continue;
    }
    if (c === '(') depthParen += 1;
    else if (c === ')') depthParen = Math.max(0, depthParen - 1);
    else if (c === '[') depthBracket += 1;
    else if (c === ']') depthBracket = Math.max(0, depthBracket - 1);
    else if (c === ':' && depthParen === 0 && depthBracket === 0) {
      return balanceConditionParens(body.slice(0, i).trim());
    }
  }
  let tail = body.trim();
  if (tail.endsWith(':')) tail = tail.slice(0, -1).trim();
  return balanceConditionParens(tail) || null;
}

/** Parse body of `если …:` into condition / condition_not blocks. */
export function parseIfConditionFromDsl(inner) {
  const fromLine = extractIfConditionFromLine(`если ${String(inner || '').trim()}`);
  const body = (fromLine ?? String(inner || '').trim()).replace(/:?\s*$/, '');
  const negRe = /^(.+?)\s+не\s+(==|!=|>=|<=|>|<|содержит|начинается_с|в)\s+(.+)$/u;
  const m = body.match(negRe);
  if (m) {
    return {
      type: 'condition_not',
      props: { cond: balanceConditionParens(`${m[1].trim()} ${m[2]} ${m[3].trim()}`) },
    };
  }
  return { type: 'condition', props: { cond: balanceConditionParens(body) } };
}
