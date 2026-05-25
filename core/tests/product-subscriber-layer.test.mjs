import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createProductSubscriberLayer,
  AudienceEngine,
  registerSubscriberProductExtensions,
  resetSubscriberProductExtensionsForTests,
  SUBSCRIBER_FLOW_BLOCKS,
} from '../product/subscriber/index.ts';
import {
  effectsForBlockType,
  applyExecutionEffectsWithSubscriber,
  subscriberTagEffect,
  resetSubscriberCapabilityExtensionsForTests,
} from '../subscriber/index.ts';
import { createExecutionContext } from '../runtime/executionContext.ts';
import { ensureCapabilityExecutorsRegistered, executeCapability } from '../runtime/capabilityExecutors.ts';
import { CAPABILITY_ACTIONS } from '../capabilities/capabilityIds.mjs';
import { bindNodeScope } from '../runtime/executionContext.ts';

describe('product subscriber layer', () => {
  it('bootstraps product layer with audience + pipeline', () => {
    const layer = createProductSubscriberLayer({
      mode: 'memory',
      startEventTriggers: false,
      startEventPipeline: false,
    });
    assert.ok(layer.audience);
    assert.ok(layer.pipeline);
    assert.ok(layer.stateManager);
  });

  it('effectsForBlockType maps product blocks', () => {
    const tag = effectsForBlockType(SUBSCRIBER_FLOW_BLOCKS.ADD_TAG, { tag: 'buyer' });
    assert.equal(tag[0]?.type, 'subscriberTag');

    const field = effectsForBlockType(SUBSCRIBER_FLOW_BLOCKS.SET_FIELD, {
      field: 'plan',
      value: 'pro',
    });
    assert.equal(field[0]?.type, 'subscriberSetField');

    const evt = effectsForBlockType(SUBSCRIBER_FLOW_BLOCKS.TRACK_EVENT, {
      eventType: 'subscriber.goal_reached',
    });
    assert.equal(evt[0]?.type, 'subscriberTrackEvent');
  });

  it('subscriber_tag capability applies when context bound', async () => {
    resetSubscriberCapabilityExtensionsForTests();
    resetSubscriberProductExtensionsForTests();
    ensureCapabilityExecutorsRegistered();

    const layer = createProductSubscriberLayer({
      mode: 'memory',
      startEventTriggers: false,
      startEventPipeline: false,
    });

    const ctx = createExecutionContext({ user: { id: 42 }, vars: {} });
    await layer.bindFlowExecution(ctx, 'bot_product');

    bindNodeScope(ctx, {
      blockType: SUBSCRIBER_FLOW_BLOCKS.ADD_TAG,
      payload: { tag: 'vip' },
    });

    const cap = await executeCapability(CAPABILITY_ACTIONS.SUBSCRIBER_TAG, ctx);
    assert.equal(cap.ok, true);
    await applyExecutionEffectsWithSubscriber(ctx, cap.effects, {
      stateManager: layer.stateManager,
    });

    const bound = layer.stateManager.getBoundContext(ctx);
    assert.ok(bound?.subscriber.tags.includes('vip'));
  });

  it('audience engine evaluates tag filter', async () => {
    const layer = createProductSubscriberLayer({
      mode: 'memory',
      startEventTriggers: false,
      startEventPipeline: false,
    });
    const engine = new AudienceEngine(layer.stateManager);
    let sub = await layer.stateManager.subscribers.getOrCreate({
      botId: 'aud_bot',
      externalUserId: '99',
    });
    sub = await layer.stateManager.tags.addTag(sub, 'newsletter');
    const match = engine.evaluateExpression('tag:newsletter', sub);
    assert.equal(match, true);
  });
});
