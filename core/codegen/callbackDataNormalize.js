/**
 * Canonical callback_data normalization + cross-layer matching (UI, codegen, preview).
 * Single source of truth for inline keyboard callback identity.
 */

import { validateCallbackData } from './callbackDataValidation.js';

const CALLBACK_PREFIX = 'callback_';

/**
 * Trim + Unicode NFC (Telegram compares UTF-8 bytes; NFC avoids false mismatches).
 * @param {string} value
 * @returns {string}
 */
export function normalizeCallbackData(value) {
  return String(value ?? '')
    .normalize('NFC')
    .trim();
}

/**
 * Catalog-style implicit callback for button label without explicit `->` / `|`.
 * «Да» → callback_да (matches block_catalog defaults).
 * @param {string} buttonLabel
 * @returns {string}
 */
export function implicitCallbackFromButtonLabel(buttonLabel) {
  const label = normalizeCallbackData(buttonLabel);
  if (!label) return '';
  if (/^[a-zA-Z0-9_:.-]{1,64}$/.test(label)) return label;
  const lower = label.toLocaleLowerCase('ru');
  return `${CALLBACK_PREFIX}${lower}`;
}

/**
 * Resolve inline button callback for storage/codegen.
 * @param {string} buttonText
 * @param {string} [explicitCallback] — from «Текст -> cb» or «Текст|cb»
 */
export function resolveInlineButtonCallback(buttonText, explicitCallback) {
  const text = normalizeCallbackData(buttonText);
  const explicit = normalizeCallbackData(explicitCallback);
  if (explicit) return explicit;
  return implicitCallbackFromButtonLabel(text);
}

/**
 * Keys used for handler↔button matching (exact + legacy aliases).
 * @param {string} value
 * @returns {string[]}
 */
export function expandCallbackMatchKeys(value) {
  const raw = normalizeCallbackData(value);
  if (!raw) return [];
  const keys = new Set();
  keys.add(raw);
  const lowerRu = raw.toLocaleLowerCase('ru');
  const lowerEn = raw.toLocaleLowerCase('en');
  keys.add(lowerRu);
  keys.add(lowerEn);

  if (raw.startsWith(CALLBACK_PREFIX)) {
    const rest = raw.slice(CALLBACK_PREFIX.length);
    if (rest) {
      keys.add(rest);
      keys.add(rest.toLocaleLowerCase('ru'));
    }
  } else {
    keys.add(implicitCallbackFromButtonLabel(raw));
    keys.add(`${CALLBACK_PREFIX}${lowerRu}`);
  }
  return [...keys];
}

/**
 * @param {string} required — callback_data from inline keyboard
 * @param {string} handlerValue — props.data / label / prefix target
 * @returns {boolean}
 */
export function callbackKeysMatch(required, handlerValue) {
  const reqKeys = new Set(expandCallbackMatchKeys(required));
  return expandCallbackMatchKeys(handlerValue).some((k) => reqKeys.has(k));
}

/**
 * @param {string} required
 * @param {string} prefix
 * @returns {boolean}
 */
export function callbackPrefixMatches(required, prefix) {
  const p = normalizeCallbackData(prefix);
  const r = normalizeCallbackData(required);
  if (!p || !r) return false;
  return r.startsWith(p);
}

/**
 * Validate for codegen emit; throws nothing — returns issues.
 * @param {string} callbackData
 * @returns {{ ok: boolean, message?: string }}
 */
export function validateCallbackDataForCodegen(callbackData) {
  return validateCallbackData(callbackData);
}
