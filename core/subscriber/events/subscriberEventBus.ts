import type { SubscriberEventRecord } from "../entities/types.js";

export type SubscriberEventHandler = (
  event: SubscriberEventRecord,
) => void | Promise<void>;

/**
 * In-process pub/sub for subscriber lifecycle (UI, webhooks, analytics).
 */
export class SubscriberEventBus {
  private readonly handlers = new Map<string, Set<SubscriberEventHandler>>();
  private readonly wildcard = new Set<SubscriberEventHandler>();

  on(type: string, handler: SubscriberEventHandler): () => void {
    const key = String(type || "").trim();
    const set = this.handlers.get(key) ?? new Set();
    set.add(handler);
    this.handlers.set(key, set);
    return () => set.delete(handler);
  }

  onAny(handler: SubscriberEventHandler): () => void {
    this.wildcard.add(handler);
    return () => this.wildcard.delete(handler);
  }

  async emit(event: SubscriberEventRecord): Promise<void> {
    const tasks: Promise<void>[] = [];
    const typeSet = this.handlers.get(event.type);
    if (typeSet) {
      for (const h of typeSet) {
        tasks.push(Promise.resolve(h(event)));
      }
    }
    for (const h of this.wildcard) {
      tasks.push(Promise.resolve(h(event)));
    }
    await Promise.all(tasks);
  }
}

let defaultBus: SubscriberEventBus | null = null;

export function getDefaultSubscriberEventBus(): SubscriberEventBus {
  if (!defaultBus) defaultBus = new SubscriberEventBus();
  return defaultBus;
}
