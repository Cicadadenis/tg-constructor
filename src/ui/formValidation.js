/**
 * Inline form validation helpers.
 */

/**
 * @param {unknown} value
 * @param {string} [message]
 */
export function required(value, message = 'This field is required') {
  if (value == null || String(value).trim() === '') return message;
  return null;
}

/**
 * @param {unknown} value
 * @param {number} min
 * @param {string} [message]
 */
export function minLength(value, min, message) {
  const s = String(value ?? '');
  if (s.length < min) return message || `Minimum ${min} characters`;
  return null;
}

/**
 * @param {Record<string, unknown>} values
 * @param {Record<string, Array<(v: unknown, all: Record<string, unknown>) => string | null>>} rules
 * @returns {{ ok: boolean, errors: Record<string, string> }}
 */
export function validateForm(values, rules) {
  /** @type {Record<string, string>} */
  const errors = {};
  for (const [key, validators] of Object.entries(rules)) {
    for (const fn of validators) {
      const msg = fn(values[key], values);
      if (msg) {
        errors[key] = msg;
        break;
      }
    }
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

/**
 * @param {string | null | undefined} validationMessage
 * @param {string} fieldKey
 */
export function fieldErrorFromValidation(validationMessage, fieldKey) {
  if (!validationMessage) return null;
  const lower = validationMessage.toLowerCase();
  const keyLower = fieldKey.toLowerCase();
  if (lower.includes(keyLower)) return validationMessage;
  return null;
}
