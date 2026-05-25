/**
 * Subscriber CRM API (ManyChat-style) — opt-in Express routes.
 */

import {
  bootstrapSubscriberRuntime,
  SubscriberEventTypes,
} from '../../core/subscriber/index.ts';

/**
 * @param {import('express').Express} app
 * @param {{ requireAuth?: (req: import('express').Request) => boolean }} [options]
 */
export function registerSubscriberRoutes(app, options = {}) {
  const { requireAuth = () => true } = options;
  const runtime = bootstrapSubscriberRuntime({ mode: 'memory', startEventTriggers: true });

  app.get('/api/bots/:botId/subscribers', async (req, res) => {
    if (!requireAuth(req)) return res.status(403).json({ error: 'forbidden' });
    const { botId } = req.params;
    const list = await runtime.repos.subscribers.listByBot(botId);
    res.json({ subscribers: list });
  });

  app.get('/api/bots/:botId/subscribers/:subscriberId', async (req, res) => {
    if (!requireAuth(req)) return res.status(403).json({ error: 'forbidden' });
    const sub = await runtime.repos.subscribers.getById(req.params.subscriberId);
    if (!sub || sub.botId !== req.params.botId) return res.status(404).json({ error: 'not_found' });
    const events = await runtime.repos.events.listForSubscriber(sub.id, 50);
    res.json({ subscriber: sub, events });
  });

  app.post('/api/bots/:botId/subscribers/:subscriberId/tags', async (req, res) => {
    if (!requireAuth(req)) return res.status(403).json({ error: 'forbidden' });
    const sub = await runtime.repos.subscribers.getById(req.params.subscriberId);
    if (!sub) return res.status(404).json({ error: 'not_found' });
    const tag = String(req.body?.tag ?? '').trim();
    if (!tag) return res.status(400).json({ error: 'tag_required' });
    const next = await runtime.stateManager.tags.addTag(sub, tag);
    res.json({ subscriber: next });
  });

  app.delete('/api/bots/:botId/subscribers/:subscriberId/tags/:tag', async (req, res) => {
    if (!requireAuth(req)) return res.status(403).json({ error: 'forbidden' });
    const sub = await runtime.repos.subscribers.getById(req.params.subscriberId);
    if (!sub) return res.status(404).json({ error: 'not_found' });
    const next = await runtime.stateManager.tags.removeTag(sub, req.params.tag);
    res.json({ subscriber: next });
  });

  app.patch('/api/bots/:botId/subscribers/:subscriberId/fields/:key', async (req, res) => {
    if (!requireAuth(req)) return res.status(403).json({ error: 'forbidden' });
    const sub = await runtime.repos.subscribers.getById(req.params.subscriberId);
    if (!sub) return res.status(404).json({ error: 'not_found' });
    const next = await runtime.stateManager.fields.setField(
      sub,
      req.params.key,
      req.body?.value,
    );
    res.json({ subscriber: next });
  });

  app.get('/api/bots/:botId/segments', async (req, res) => {
    if (!requireAuth(req)) return res.status(403).json({ error: 'forbidden' });
    const segments = await runtime.stateManager.segments.listByBot(req.params.botId);
    res.json({ segments });
  });

  app.post('/api/bots/:botId/segments', async (req, res) => {
    if (!requireAuth(req)) return res.status(403).json({ error: 'forbidden' });
    const { name, filter, description } = req.body ?? {};
    if (!name || !filter) return res.status(400).json({ error: 'name_and_filter_required' });
    const segment = await runtime.stateManager.segments.create(
      req.params.botId,
      String(name),
      filter,
      String(description ?? ''),
    );
    res.status(201).json({ segment });
  });

  app.post('/api/bots/:botId/segments/:segmentId/evaluate', async (req, res) => {
    if (!requireAuth(req)) return res.status(403).json({ error: 'forbidden' });
    const segment = await runtime.repos.segments.getById(req.params.segmentId);
    if (!segment) return res.status(404).json({ error: 'not_found' });
    const members = await runtime.stateManager.segments.resolveMembers(segment);
    res.json({ count: members.length, subscriberIds: members.map((s) => s.id) });
  });

  app.get('/api/bots/:botId/event-types', (_req, res) => {
    res.json({ types: Object.values(SubscriberEventTypes) });
  });

  return runtime;
}
