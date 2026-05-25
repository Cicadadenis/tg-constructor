/**
 * Bridges execution effects ↔ subscriber state without modifying the core effect applier.
 */

import { applyExecutionEffects } from '../../runtime/execution/executionEffects.mjs';
import { emitEventEffect } from '../../runtime/execution/executionEffects.mjs';
import { isSubscriberDomainEvent } from '../events/subscriberEventTypes.js';
import { isSubscriberEffect } from './subscriberEffects.mjs';

/**
 * @typedef {import('../../runtime/executionContext.js').ExecutionContext} ExecutionContext
 * @typedef {import('../services/subscriberStateManager.js').SubscriberStateManager} SubscriberStateManager
 */

/**
 * @param {ExecutionContext} ctx
 * @param {readonly import('../../runtime/execution/executionEffects.mjs').ExecutionEffect[]} effects
 * @param {object} options
 * @param {SubscriberStateManager} options.stateManager
 * @param {boolean} [options.replayOnly]
 */
export async function applyExecutionEffectsWithSubscriber(ctx, effects, options) {
  const stateManager = options.stateManager;
  const replayOnly = options.replayOnly === true;
  const executionEffects = [];
  const subscriberEffects = [];

  for (const effect of effects || []) {
    if (isSubscriberEffect(effect)) {
      subscriberEffects.push(effect);
    } else {
      executionEffects.push(effect);
    }
  }

  await applyExecutionEffects(ctx, executionEffects, {
    replayOnly,
    onEmitEvent: async (effect) => {
      if (replayOnly) return;
      await handleSubscriberEmitEvent(ctx, effect, stateManager);
    },
  });

  if (!replayOnly && subscriberEffects.length) {
    await applySubscriberEffects(ctx, subscriberEffects, stateManager);
  }
}

/**
 * @param {ExecutionContext} ctx
 * @param {import('../../runtime/execution/executionEffects.mjs').EmitEventEffect} effect
 * @param {SubscriberStateManager} stateManager
 */
async function handleSubscriberEmitEvent(ctx, effect, stateManager) {
  if (!isSubscriberDomainEvent(effect.eventType)) {
    ctx.logger.info(effect.eventType, { traceId: ctx.traceId, ...effect.payload });
    return;
  }

  const subCtx = stateManager.getBoundContext(ctx);
  if (!subCtx) return;

  await stateManager.events.track(
    subCtx.subscriber,
    effect.eventType,
    { ...effect.payload },
    'flow',
  );
  await stateManager.refreshAfterMutation(ctx);
}

/**
 * @param {ExecutionContext} ctx
 * @param {readonly import('./subscriberEffects.mjs').SubscriberEffect[]} effects
 * @param {SubscriberStateManager} stateManager
 */
export async function applySubscriberEffects(ctx, effects, stateManager) {
  let subCtx = stateManager.getBoundContext(ctx);
  if (!subCtx) return;

  for (const effect of effects) {
    switch (effect.type) {
      case 'subscriberTag': {
        if (effect.action === 'remove') {
          subCtx = {
            ...subCtx,
            subscriber: await stateManager.tags.removeTag(subCtx.subscriber, effect.tag),
          };
        } else {
          subCtx = {
            ...subCtx,
            subscriber: await stateManager.tags.addTag(subCtx.subscriber, effect.tag),
          };
        }
        break;
      }
      case 'subscriberSetField': {
        subCtx = {
          ...subCtx,
          subscriber: await stateManager.fields.setField(
            subCtx.subscriber,
            effect.field,
            effect.value,
          ),
        };
        break;
      }
      case 'subscriberSetAttribute': {
        subCtx = {
          ...subCtx,
          subscriber: await stateManager.variables.setAttribute(
            subCtx.subscriber,
            effect.key,
            effect.value,
          ),
        };
        break;
      }
      case 'subscriberSetVariable': {
        const session = await stateManager.variables.setSessionVariable(
          subCtx.session,
          effect.key,
          effect.value,
        );
        subCtx = { ...subCtx, session };
        break;
      }
      case 'subscriberTrackEvent': {
        await stateManager.events.track(
          subCtx.subscriber,
          effect.eventType,
          { ...effect.payload },
          'flow',
        );
        break;
      }
      default:
        break;
    }
  }

  ctx.temp.__subscriberContext = subCtx;
  await stateManager.refreshAfterMutation(ctx);
}

/**
 * Map flow block payloads to subscriber + execution effects (tag / set_global / analytics).
 * @param {string} blockType
 * @param {Record<string, unknown>} payload
 * @returns {readonly (import('../../runtime/execution/executionEffects.mjs').ExecutionEffect | import('./subscriberEffects.mjs').SubscriberEffect)[]}
 */
export function effectsForBlockType(blockType, payload = {}) {
  const t = String(blockType || '').trim();
  const p = payload || {};
  const out = [];

  if (t === 'set_global' || t === 'tag') {
    const tag = String(p.tag ?? p.name ?? p.key ?? '').trim();
    if (tag) {
      out.push(
        /** @type {import('./subscriberEffects.mjs').SubscriberTagEffect} */ (
          { type: 'subscriberTag', tag, action: 'add' }
        ),
      );
    }
  }

  if (t === 'untag' || t === 'remove_tag') {
    const tag = String(p.tag ?? p.name ?? '').trim();
    if (tag) {
      out.push(
        { type: 'subscriberTag', tag, action: 'remove' },
      );
    }
  }

  if (t === 'db.set' || (t === 'save' && p.key)) {
    const field = String(p.key ?? p.field ?? '').trim();
    if (field) {
      out.push(
        { type: 'subscriberSetField', field, value: p.value ?? p.val ?? null },
      );
    }
  }

  if (t === 'set_variable' || t === 'remember' || t === 'get' || t === 'save') {
    const key = String(p.varname ?? p.key ?? p.name ?? '').trim();
    if (key) {
      out.push(
        /** @type {import('./subscriberEffects.mjs').SubscriberVariableEffect} */ (
          { type: 'subscriberSetVariable', key, value: p.value ?? p.val ?? null }
        ),
      );
    }
  }

  if (t === 'analytics') {
    out.push(
      emitEventEffect('subscriber.custom', {
        event: String(p.event ?? 'analytics'),
        ...p,
      }),
    );
  }

  return Object.freeze(out);
}
