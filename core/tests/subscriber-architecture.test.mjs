import assert from 'node:assert/strict';
import { describe, it, before } from 'node:test';

import {
  createInMemorySubscriberRepositories,
  createSubscriberRepositories,
  createSubscriberStateManager,
  evaluateSegmentFilter,
  evaluateDynamicCondition,
  parseConditionExpression,
  applyExecutionEffectsWithSubscriber,
  subscriberTagEffect,
  subscriberSetFieldEffect,
  subscriberUntagEffect,
  effectsForBlockType,
  bootstrapSubscriberRuntime,
  EventTriggerService,
  registerSubscriberCapabilityExtensions,
  resetSubscriberCapabilityExtensionsForTests,
} from '../subscriber/index.ts';
import { createExecutionContext, bindNodeScope } from '../runtime/executionContext.ts';
import { setStateEffect } from '../runtime/execution/executionEffects.mjs';
import { applyExecutionEffects } from '../runtime/execution/executionEffects.mjs';
import { InMemoryExecutionDb } from '../runtime/executionDb.ts';
import { TagService } from '../subscriber/services/tagService.js';
import { SubscriberService } from '../subscriber/services/subscriberService.js';
import { ensureCapabilityExecutorsRegistered, executeCapability } from '../runtime/capabilityExecutors.ts';
import { CAPABILITY_ACTIONS } from '../capabilities/capabilityIds.mjs';

describe('subscriber architecture', () => {
  it('creates subscriber context from telegram identity', async () => {
    const repos = createInMemorySubscriberRepositories();
    const manager = createSubscriberStateManager(repos);

    const ctx = createExecutionContext({
      traceId: 'run-1',
      user: { id: 12345, first_name: 'Anna' },
      chat: { id: 990000001 },
      vars: {},
    });

    const subCtx = await manager.bindExecutionContext(ctx, { botId: 'bot_test' });
    assert.equal(subCtx.subscriber.externalUserId, '12345');
    assert.equal(ctx.vars.__subscriberId, subCtx.subscriber.id);
    assert.equal(ctx.vars['subscriber.plan'], undefined);
  });

  it('applies tag and field subscriber effects', async () => {
    const repos = createInMemorySubscriberRepositories();
    const manager = createSubscriberStateManager(repos);

    const ctx = createExecutionContext({
      user: { id: 99 },
      vars: {},
    });
    await manager.bindExecutionContext(ctx, { botId: 'bot_a' });

    await applyExecutionEffectsWithSubscriber(ctx, [
      subscriberTagEffect('vip'),
      subscriberSetFieldEffect('plan', 'pro'),
      setStateEffect({ flow_flag: true }),
    ], { stateManager: manager });

    const bound = manager.getBoundContext(ctx);
    assert.ok(bound?.subscriber.tags.includes('vip'));
    assert.equal(bound?.subscriber.customFields.plan, 'pro');
    assert.equal(ctx.vars.flow_flag, true);
  });

  it('segment engine filters by tag', async () => {
    const repos = createInMemorySubscriberRepositories();
    const subs = new SubscriberService(repos);
    const tags = new TagService(repos);

    let s = await subs.getOrCreate({ botId: 'b1', externalUserId: '1' });
    s = await tags.addTag(s, 'buyer');

    const match = evaluateSegmentFilter(
      { op: 'hasTag', tag: 'buyer' },
      { subscriber: s },
    );
    assert.equal(match, true);
  });

  it('effectsForBlockType maps set_global to subscriber tag', () => {
    const fx = effectsForBlockType('set_global', { tag: 'newsletter' });
    assert.equal(fx[0]?.type, 'subscriberTag');
  });

  it('effectsForBlockType maps untag and db.set', () => {
    const untag = effectsForBlockType('untag', { tag: 'old' });
    assert.equal(untag[0]?.type, 'subscriberTag');
    assert.equal(untag[0]?.action, 'remove');

    const field = effectsForBlockType('db.set', { key: 'email', value: 'a@b.c' });
    assert.equal(field[0]?.type, 'subscriberSetField');
  });

  it('dynamic condition shorthand tag:vip', async () => {
    const repos = createInMemorySubscriberRepositories();
    const manager = createSubscriberStateManager(repos);
    const ctx = createExecutionContext({ user: { id: 1 }, vars: {} });
    await manager.bindExecutionContext(ctx, { botId: 'b' });
    await applyExecutionEffectsWithSubscriber(ctx, [subscriberTagEffect('vip')], {
      stateManager: manager,
    });
    const ok = await manager.evaluateCondition(ctx, 'tag:vip');
    assert.equal(ok, true);
  });

  it('parseConditionExpression handles JSON filter', () => {
    const f = parseConditionExpression('{"op":"hasTag","tag":"buyer"}');
    assert.equal(f?.op, 'hasTag');
  });

  it('evaluateDynamicCondition with hasAnyTag via JSON', async () => {
    const repos = createInMemorySubscriberRepositories();
    const subs = new SubscriberService(repos);
    const tags = new TagService(repos);
    let s = await subs.getOrCreate({ botId: 'b', externalUserId: '2' });
    s = await tags.addTag(s, 'a');
    const match = evaluateDynamicCondition(
      JSON.stringify({ op: 'hasAnyTag', tags: ['a', 'b'] }),
      { subscriber: s },
    );
    assert.equal(match, true);
  });

  it('persists subscribers via executionDb repositories', async () => {
    const db = new InMemoryExecutionDb();
    const repos = createSubscriberRepositories({ mode: 'executionDb', db });
    const svc = new SubscriberService(repos);
    const s = await svc.getOrCreate({ botId: 'persist', externalUserId: '42' });
    const again = await repos.subscribers.findByExternal('persist', 'telegram', '42');
    assert.equal(again?.id, s.id);
  });

  it('event trigger fires on tag_added', async () => {
    const repos = createInMemorySubscriberRepositories();
    const manager = createSubscriberStateManager(repos);
    let triggered = false;
    const triggers = new EventTriggerService(undefined, async () => {
      triggered = true;
    });
    triggers.register({
      id: 't1',
      botId: 'bot_ev',
      eventType: 'subscriber.tag_added',
      flowId: 'flow_welcome',
      enabled: true,
    });
    triggers.startListening();

    const ctx = createExecutionContext({ user: { id: 7 }, vars: {} });
    await manager.bindExecutionContext(ctx, { botId: 'bot_ev' });
    await applyExecutionEffectsWithSubscriber(ctx, [subscriberTagEffect('new')], {
      stateManager: manager,
    });

    await new Promise((r) => setTimeout(r, 10));
    assert.equal(triggered, true);
    triggers.stopListening();
  });

  it('bootstrapSubscriberRuntime returns bundle', () => {
    const bundle = bootstrapSubscriberRuntime({ mode: 'memory', startEventTriggers: false });
    assert.ok(bundle.stateManager);
    assert.ok(bundle.repos);
    assert.ok(bundle.eventTriggers);
  });

  it('BRANCH capability evaluates subscriber condition when bound', async () => {
    resetSubscriberCapabilityExtensionsForTests();
    ensureCapabilityExecutorsRegistered();
    const repos = createInMemorySubscriberRepositories();
    const manager = createSubscriberStateManager(repos);
    registerSubscriberCapabilityExtensions(manager);

    const ctx = createExecutionContext({
      user: { id: 55 },
      vars: {},
    });
    await manager.bindExecutionContext(ctx, { botId: 'branch_bot' });
    await applyExecutionEffectsWithSubscriber(ctx, [subscriberTagEffect('buyer')], {
      stateManager: manager,
    });

    bindNodeScope(ctx, {
      payload: { expression: 'tag:buyer' },
      blockType: 'condition',
    });
    const result = await executeCapability(CAPABILITY_ACTIONS.BRANCH, ctx);
    assert.equal(result.ok, true);
    assert.equal(result.nextPort, 'true');
    await applyExecutionEffects(ctx, result.effects);
    assert.equal(ctx.vars.__lastCondition, true);
    assert.equal(ctx.vars.__conditionPort, 'true');
  });
});
