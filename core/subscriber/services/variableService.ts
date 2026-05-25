import { newEventId } from "../entities/ids.js";
import type { Subscriber, SubscriberSession } from "../entities/types.js";
import { SubscriberEventTypes } from "../events/subscriberEventTypes.js";
import type { SubscriberRepositories } from "../repositories/interfaces.js";
import { getDefaultSubscriberRepositories } from "../repositories/inMemoryRepositories.js";

/**
 * Subscriber-scoped variables (ManyChat Custom Fields / User Fields in session).
 * Merged into execution ctx.vars under subscriber.* prefix when bound.
 */
export class VariableService {
  constructor(
    private readonly repos: SubscriberRepositories = getDefaultSubscriberRepositories(),
  ) {}

  async setSessionVariable(
    session: SubscriberSession,
    key: string,
    value: unknown,
  ): Promise<SubscriberSession> {
    const k = String(key || "").trim();
    if (!k) return session;
    const next: SubscriberSession = {
      ...session,
      variables: Object.freeze({ ...session.variables, [k]: value }),
      updatedAt: new Date().toISOString(),
    };
    await this.repos.sessions.save(next);
    return next;
  }

  async setAttribute(subscriber: Subscriber, key: string, value: unknown): Promise<Subscriber> {
    const k = String(key || "").trim();
    if (!k) return subscriber;
    const next: Subscriber = {
      ...subscriber,
      attributes: Object.freeze({ ...subscriber.attributes, [k]: value }),
      updatedAt: new Date().toISOString(),
    };
    await this.repos.subscribers.save(next);
    await this.repos.events.append({
      id: newEventId(),
      subscriberId: next.id,
      botId: next.botId,
      type: SubscriberEventTypes.ATTRIBUTE_UPDATED,
      payload: Object.freeze({ key: k, value }),
      occurredAt: new Date().toISOString(),
      source: "flow",
    });
    return next;
  }

  /**
   * Merge subscriber fields + session vars into execution variables map.
   */
  static mergeIntoExecutionVars(
    ctxVars: Record<string, unknown>,
    subscriber: Subscriber,
    session: SubscriberSession,
  ): Record<string, unknown> {
    const merged = { ...ctxVars };
    for (const [k, v] of Object.entries(subscriber.customFields)) {
      merged[`subscriber.${k}`] = v;
    }
    for (const [k, v] of Object.entries(subscriber.attributes)) {
      merged[`attr.${k}`] = v;
    }
    for (const [k, v] of Object.entries(session.variables)) {
      merged[`session.${k}`] = v;
    }
    merged.__subscriberId = subscriber.id;
    merged.__conversationId = session.conversationId;
    merged.__sessionId = session.id;
    return merged;
  }
}
