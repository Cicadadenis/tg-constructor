/**
 * Subscriber CRM API — product layer on top of core/subscriber (opt-in).
 */

import {
  createProductSubscriberLayer,
  createSubscriberProductApi,
  SubscriberEventTypes,
} from '../../core/product/subscriber/index.ts';

/** @type {import('../../core/product/subscriber/productSubscriberLayer.js').ProductSubscriberLayer | null} */
let sharedRuntime = null;

/**
 * @param {import('express').Express} app
 * @param {{
 *   requireAuth?: (req: import('express').Request) => boolean,
 *   authMiddleware?: (req: import('express').Request, res: import('express').Response, next: () => void) => void,
 *   runtime?: object,
 * }} [options]
 */
export function registerSubscriberRoutes(app, options = {}) {
  const { requireAuth = () => true, authMiddleware, runtime: runtimeIn } = options;
  const auth = authMiddleware
    ? [authMiddleware]
    : [];
  const runtime = runtimeIn ?? createProductSubscriberLayer({
    mode: 'memory',
    startEventTriggers: true,
    startEventPipeline: true,
  });
  sharedRuntime = runtime;
  const api = createSubscriberProductApi(runtime);

  const guard = (req, res) => {
    if (!requireAuth(req)) {
      res.status(403).json({ error: 'forbidden' });
      return false;
    }
    return true;
  };

  /** @param {'get'|'post'|'patch'|'delete'} method */
  const route = (method, path, ...handlers) => {
    app[method](path, ...auth, ...handlers);
  };

  route('get', '/api/bots/:botId/subscribers', async (req, res) => {
    if (!guard(req, res)) return;
    const list = await api.listSubscribers(req.params.botId);
    res.json({ subscribers: list });
  });

  route('get', '/api/bots/:botId/subscribers/:subscriberId', async (req, res) => {
    if (!guard(req, res)) return;
    const sub = await api.getSubscriber(req.params.subscriberId);
    if (!sub || sub.botId !== req.params.botId) {
      return res.status(404).json({ error: 'not_found' });
    }
    const events = await api.listEvents(req.params.subscriberId, 50);
    res.json({ subscriber: sub, events });
  });

  route('post', '/api/bots/:botId/subscribers/:subscriberId/tags', async (req, res) => {
    if (!guard(req, res)) return;
    const sub = await api.getSubscriber(req.params.subscriberId);
    if (!sub) return res.status(404).json({ error: 'not_found' });
    const tag = String(req.body?.tag ?? '').trim();
    if (!tag) return res.status(400).json({ error: 'tag_required' });
    const next = await api.addTag(sub, tag);
    res.json({ subscriber: next });
  });

  route('delete', '/api/bots/:botId/subscribers/:subscriberId/tags/:tag', async (req, res) => {
    if (!guard(req, res)) return;
    const sub = await api.getSubscriber(req.params.subscriberId);
    if (!sub) return res.status(404).json({ error: 'not_found' });
    const next = await api.removeTag(sub, req.params.tag);
    res.json({ subscriber: next });
  });

  route('patch', '/api/bots/:botId/subscribers/:subscriberId/fields/:key', async (req, res) => {
    if (!guard(req, res)) return;
    const sub = await api.getSubscriber(req.params.subscriberId);
    if (!sub) return res.status(404).json({ error: 'not_found' });
    const next = await api.setField(sub, req.params.key, req.body?.value);
    res.json({ subscriber: next });
  });

  route('patch', '/api/bots/:botId/subscribers/:subscriberId/variables/:key', async (req, res) => {
    if (!guard(req, res)) return;
    const sub = await api.getSubscriber(req.params.subscriberId);
    if (!sub) return res.status(404).json({ error: 'not_found' });
    const session = await runtime.repos.sessions.getActiveForSubscriber(sub.id);
    if (!session) return res.status(404).json({ error: 'no_active_session' });
    const updated = await api.setSessionVariable(session.id, req.params.key, req.body?.value);
    res.json({ session: updated });
  });

  route('get', '/api/bots/:botId/subscribers/:subscriberId/events', async (req, res) => {
    if (!guard(req, res)) return;
    const limit = Math.min(200, Number(req.query.limit) || 50);
    const events = await api.listEvents(req.params.subscriberId, limit);
    res.json({ events });
  });

  route('get', '/api/bots/:botId/subscribers/:subscriberId/sessions', async (req, res) => {
    if (!guard(req, res)) return;
    const sessions = await api.listSessions(req.params.subscriberId);
    res.json({ sessions });
  });

  route('get', '/api/bots/:botId/tags', async (req, res) => {
    if (!guard(req, res)) return;
    const tags = await api.listTags(req.params.botId);
    res.json({ tags });
  });

  route('get', '/api/bots/:botId/custom-fields', async (req, res) => {
    if (!guard(req, res)) return;
    const fields = await api.listCustomFields(req.params.botId);
    res.json({ fields });
  });

  route('post', '/api/bots/:botId/custom-fields', async (req, res) => {
    if (!guard(req, res)) return;
    const { key, label, type, defaultValue } = req.body ?? {};
    if (!key) return res.status(400).json({ error: 'key_required' });
    const field = await runtime.stateManager.fields.defineField(
      req.params.botId,
      String(key),
      String(label ?? key),
      type ?? 'text',
      defaultValue,
    );
    res.status(201).json({ field });
  });

  route('get', '/api/bots/:botId/segments', async (req, res) => {
    if (!guard(req, res)) return;
    const segments = await api.listSegments(req.params.botId);
    res.json({ segments });
  });

  route('post', '/api/bots/:botId/segments', async (req, res) => {
    if (!guard(req, res)) return;
    const { name, filter, description } = req.body ?? {};
    if (!name || !filter) return res.status(400).json({ error: 'name_and_filter_required' });
    const segment = await api.createSegment(
      req.params.botId,
      String(name),
      filter,
      String(description ?? ''),
    );
    res.status(201).json({ segment });
  });

  route('post', '/api/bots/:botId/segments/:segmentId/evaluate', async (req, res) => {
    if (!guard(req, res)) return;
    const segment = await runtime.audience.getSegment(req.params.botId, req.params.segmentId);
    if (!segment) return res.status(404).json({ error: 'not_found' });
    const members = await runtime.audience.resolveSegmentMembers(segment);
    res.json({
      count: members.length,
      subscriberIds: members.map((s) => s.id),
    });
  });

  route('post', '/api/bots/:botId/audience/evaluate', async (req, res) => {
    if (!guard(req, res)) return;
    const { subscriberId, expression, filter } = req.body ?? {};
    if (!subscriberId) return res.status(400).json({ error: 'subscriber_id_required' });
    const expr = filter ?? expression;
    if (!expr) return res.status(400).json({ error: 'expression_or_filter_required' });
    const match = await runtime.audience.evaluateSubscriber(subscriberId, expr);
    res.json({ match });
  });

  route('get', '/api/bots/:botId/event-types', (_req, res) => {
    res.json({ types: Object.values(SubscriberEventTypes) });
  });

  return runtime;
}

export function getSubscriberProductRuntime() {
  return sharedRuntime;
}
