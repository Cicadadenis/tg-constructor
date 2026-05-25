/**
 * Subscriber-side effects (optional layer on top of execution effects).
 * Does not modify executionEffects.mjs — applied by subscriberExecutionBridge.
 */

/**
 * @typedef {'subscriberTag' | 'subscriberUntag' | 'subscriberSetField' | 'subscriberSetAttribute' | 'subscriberSetVariable' | 'subscriberTrackEvent'} SubscriberEffectType
 */

/**
 * @typedef {object} SubscriberTagEffect
 * @property {'subscriberTag'} type
 * @property {string} tag
 * @property {'add' | 'remove'} action
 */

/**
 * @typedef {object} SubscriberFieldEffect
 * @property {'subscriberSetField'} type
 * @property {string} field
 * @property {unknown} value
 */

/**
 * @typedef {object} SubscriberAttributeEffect
 * @property {'subscriberSetAttribute'} type
 * @property {string} key
 * @property {unknown} value
 */

/**
 * @typedef {object} SubscriberVariableEffect
 * @property {'subscriberSetVariable'} type
 * @property {string} key
 * @property {unknown} value
 */

/**
 * @typedef {object} SubscriberTrackEventEffect
 * @property {'subscriberTrackEvent'} type
 * @property {string} eventType
 * @property {Record<string, unknown>} [payload]
 */

/** @typedef {SubscriberTagEffect | SubscriberFieldEffect | SubscriberAttributeEffect | SubscriberVariableEffect | SubscriberTrackEventEffect} SubscriberEffect */

/**
 * @param {string} tag
 * @returns {SubscriberTagEffect}
 */
export function subscriberTagEffect(tag) {
  return Object.freeze({ type: 'subscriberTag', tag: String(tag), action: 'add' });
}

/**
 * @param {string} tag
 * @returns {SubscriberTagEffect}
 */
export function subscriberUntagEffect(tag) {
  return Object.freeze({ type: 'subscriberTag', tag: String(tag), action: 'remove' });
}

/**
 * @param {string} field
 * @param {unknown} value
 * @returns {SubscriberFieldEffect}
 */
export function subscriberSetFieldEffect(field, value) {
  return Object.freeze({ type: 'subscriberSetField', field: String(field), value });
}

/**
 * @param {string} key
 * @param {unknown} value
 * @returns {SubscriberAttributeEffect}
 */
export function subscriberSetAttributeEffect(key, value) {
  return Object.freeze({ type: 'subscriberSetAttribute', key: String(key), value });
}

/**
 * @param {string} key
 * @param {unknown} value
 * @returns {SubscriberVariableEffect}
 */
export function subscriberSetVariableEffect(key, value) {
  return Object.freeze({ type: 'subscriberSetVariable', key: String(key), value });
}

/**
 * @param {string} eventType
 * @param {Record<string, unknown>} [payload]
 * @returns {SubscriberTrackEventEffect}
 */
export function subscriberTrackEventEffect(eventType, payload = {}) {
  return Object.freeze({
    type: 'subscriberTrackEvent',
    eventType: String(eventType),
    payload: Object.freeze({ ...payload }),
  });
}

/**
 * @param {SubscriberEffect[]} list
 * @returns {readonly SubscriberEffect[]}
 */
export function freezeSubscriberEffects(list) {
  return Object.freeze((list || []).map((e) => Object.freeze({ ...e })));
}

/**
 * @param {import('../../runtime/execution/executionEffects.mjs').ExecutionEffect | SubscriberEffect} effect
 * @returns {boolean}
 */
export function isSubscriberEffect(effect) {
  const t = effect?.type;
  return typeof t === 'string' && t.startsWith('subscriber');
}
