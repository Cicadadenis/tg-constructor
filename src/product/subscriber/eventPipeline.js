/**
 * Client-side event pipeline — bridges UI actions to subscriber store refresh.
 * Server-side pipeline lives in core/product/subscriber/eventPipeline.ts
 */

/**
 * @typedef {object} ClientPipelineEvent
 * @property {string} type
 * @property {string} subscriberId
 * @property {string} [botId]
 * @property {Record<string, unknown>} [payload]
 */

export function createClientEventPipeline(handlers = {}) {
  const listeners = new Map();

  const on = (type, fn) => {
    const key = type || '*';
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key).add(fn);
    return () => listeners.get(key)?.delete(fn);
  };

  const emit = async (event) => {
    const types = [event.type, '*'];
    for (const t of types) {
      const set = listeners.get(t);
      if (!set) continue;
      for (const fn of set) {
        await fn(event);
      }
    }
    if (handlers.onEvent) await handlers.onEvent(event);
  };

  return { on, emit };
}

/** Wire store reload on common subscriber mutations */
export function wireSubscriberStorePipeline(pipeline, store) {
  const reloadTypes = new Set([
    'subscriber.tag_added',
    'subscriber.tag_removed',
    'subscriber.field_updated',
    'subscriber.variable_updated',
    'subscriber.custom',
  ]);

  return pipeline.on('*', async (event) => {
    if (!reloadTypes.has(event.type)) return;
    const botId = store.getState().botId;
    if (!botId) return;
    if (event.subscriberId === store.getState().selectedSubscriberId) {
      await store.getState().selectSubscriber(event.subscriberId);
    }
    await store.getState().loadSubscribers(botId);
  });
}
