/**
 * Immutable effect system — nodes return effects; engine applies them to ExecutionContext.
 */

import { requireTransport, isReplayOnly } from '../executionContext.js';

/** @typedef {'setState' | 'sendMessage' | 'callAPI' | 'emitEvent'} ExecutionEffectType */

/**
 * @typedef {object} SetStateEffect
 * @property {'setState'} type
 * @property {Record<string, unknown>} [vars] partial var updates
 * @property {unknown} [state] replace persistent state when defined
 */

/**
 * @typedef {object} SendMessageEffect
 * @property {'sendMessage'} type
 * @property {string} text
 * @property {string} [parseMode]
 * @property {unknown} [replyMarkup]
 */

/**
 * @typedef {object} CallAPIEffect
 * @property {'callAPI'} type
 * @property {string} method
 * @property {string} [url]
 * @property {unknown} [body]
 * @property {Record<string, string>} [headers]
 */

/**
 * @typedef {object} EmitEventEffect
 * @property {'emitEvent'} type
 * @property {string} eventType
 * @property {Record<string, unknown>} [payload]
 */

/** @typedef {SetStateEffect | SendMessageEffect | CallAPIEffect | EmitEventEffect} ExecutionEffect */

/**
 * @param {ExecutionEffect[]} effects
 * @returns {readonly ExecutionEffect[]}
 */
export function freezeEffects(effects) {
  return Object.freeze(
    (effects || []).map((e) => Object.freeze({ ...e })),
  );
}

/**
 * @param {ExecutionEffect[]} effects
 * @returns {readonly ExecutionEffect[]}
 */
export function effects(...effects) {
  return freezeEffects(effects);
}

/**
 * @param {Record<string, unknown>} vars
 * @param {unknown} [state]
 * @returns {SetStateEffect}
 */
export function setStateEffect(vars = {}, state = undefined) {
  return Object.freeze({
    type: 'setState',
    vars: Object.freeze({ ...vars }),
    ...(state !== undefined ? { state } : {}),
  });
}

/**
 * @param {string} text
 * @param {{ parseMode?: string, replyMarkup?: unknown }} [options]
 * @returns {SendMessageEffect}
 */
export function sendMessageEffect(text, options = {}) {
  return Object.freeze({
    type: 'sendMessage',
    text: String(text),
    ...(options.parseMode ? { parseMode: options.parseMode } : {}),
    ...(options.replyMarkup !== undefined ? { replyMarkup: options.replyMarkup } : {}),
  });
}

/**
 * @param {string} method
 * @param {{ url?: string, body?: unknown, headers?: Record<string, string> }} [options]
 * @returns {CallAPIEffect}
 */
export function callAPIEffect(method, options = {}) {
  return Object.freeze({
    type: 'callAPI',
    method: String(method),
    ...(options.url ? { url: options.url } : {}),
    ...(options.body !== undefined ? { body: options.body } : {}),
    ...(options.headers ? { headers: { ...options.headers } } : {}),
  });
}

/**
 * @param {string} eventType
 * @param {Record<string, unknown>} [payload]
 * @returns {EmitEventEffect}
 */
export function emitEventEffect(eventType, payload = {}) {
  return Object.freeze({
    type: 'emitEvent',
    eventType: String(eventType),
    payload: Object.freeze({ ...payload }),
  });
}

/**
 * @param {import('../executionContext.js').ExecutionContext} ctx
 * @param {readonly ExecutionEffect[]} effectList
 * @param {{ replayOnly?: boolean, onEmitEvent?: (effect: EmitEventEffect) => void | Promise<void> }} [options]
 */
export async function applyExecutionEffects(ctx, effectList, options = {}) {
  const replayOnly = options.replayOnly === true || isReplayOnly(ctx);
  const list = effectList || [];

  for (const effect of list) {
    switch (effect.type) {
      case 'setState': {
        if (effect.vars && typeof effect.vars === 'object') {
          Object.assign(ctx.vars, effect.vars);
        }
        if (Object.prototype.hasOwnProperty.call(effect, 'state')) {
          ctx.state = effect.state;
        }
        break;
      }
      case 'sendMessage': {
        if (replayOnly) break;
        const text = String(effect.text ?? '').trim();
        if (!text) break;
        await requireTransport(ctx).sendMessage(ctx, text, {
          parseMode: effect.parseMode,
          replyMarkup: effect.replyMarkup,
        });
        break;
      }
      case 'callAPI': {
        if (replayOnly) break;
        ctx.logger.info('callAPI effect', {
          traceId: ctx.traceId,
          method: effect.method,
          url: effect.url,
        });
        break;
      }
      case 'emitEvent': {
        if (options.onEmitEvent) {
          await options.onEmitEvent(effect);
        } else {
          ctx.logger.info(effect.eventType, {
            traceId: ctx.traceId,
            ...effect.payload,
          });
        }
        break;
      }
      default:
        throw new Error(
          `Unknown execution effect type: ${/** @type {{ type?: string }} */ (effect).type}`,
        );
    }
  }
}
