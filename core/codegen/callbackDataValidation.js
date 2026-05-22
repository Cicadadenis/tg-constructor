/**
 * Telegram inline keyboard callback_data constraints (compile-time).
 * @see https://core.telegram.org/bots/api#inlinekeyboardbutton
 */

export const CALLBACK_DATA_MAX_BYTES = 64;

/**
 * @param {string} value
 * @returns {number}
 */
export function callbackDataUtf8ByteLength(value) {
  return new TextEncoder().encode(String(value ?? '')).length;
}

/**
 * @param {string} callbackData
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
export function validateCallbackData(callbackData) {
  const cd = String(callbackData ?? '').trim();
  if (!cd) {
    return {
      ok: false,
      code: 'CALLBACK_EMPTY',
      message: 'callback_data не может быть пустым',
    };
  }
  const bytes = callbackDataUtf8ByteLength(cd);
  if (bytes > CALLBACK_DATA_MAX_BYTES) {
    return {
      ok: false,
      code: 'CALLBACK_TOO_LONG',
      message: `callback_data превышает ${CALLBACK_DATA_MAX_BYTES} байт UTF-8 (сейчас ${bytes})`,
    };
  }
  return { ok: true };
}

/**
 * @param {Array<Array<{ text?: string, callback_data?: string }>>} rows
 * @returns {Array<{ code: string, message: string, row: number, col: number, callback_data: string }>}
 */
export function validateInlineKeyboardRows(rows) {
  const issues = [];
  for (let ri = 0; ri < (rows || []).length; ri += 1) {
    const row = rows[ri] || [];
    for (let ci = 0; ci < row.length; ci += 1) {
      const btn = row[ci];
      const cd = btn?.callback_data;
      if (cd == null || cd === '') continue;
      const v = validateCallbackData(cd);
      if (!v.ok) {
        issues.push({
          code: v.code,
          message: v.message,
          row: ri,
          col: ci,
          callback_data: String(cd),
        });
      }
    }
  }
  return issues;
}
