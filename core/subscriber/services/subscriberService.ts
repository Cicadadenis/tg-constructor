import {
  newConversationId,
  newEventId,
  newSessionId,
  newSubscriberId,
} from "../entities/ids.js";
import type {
  Conversation,
  Subscriber,
  SubscriberContext,
  SubscriberSession,
  SubscriberStatus,
} from "../entities/types.js";
import { SubscriberEventTypes } from "../events/subscriberEventTypes.js";
import type { SubscriberEventBus } from "../events/subscriberEventBus.js";
import type { SubscriberRepositories } from "../repositories/interfaces.js";
import { getDefaultSubscriberRepositories } from "../repositories/inMemoryRepositories.js";
import { getDefaultSubscriberEventBus } from "../events/subscriberEventBus.js";

export interface ResolveSubscriberInput {
  botId: string;
  channel?: string;
  externalUserId: string;
  displayName?: string;
  locale?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

export class SubscriberService {
  constructor(
    private readonly repos: SubscriberRepositories = getDefaultSubscriberRepositories(),
    private readonly bus: SubscriberEventBus = getDefaultSubscriberEventBus(),
  ) {}

  async getById(id: string): Promise<Subscriber | null> {
    return this.repos.subscribers.getById(id);
  }

  async getOrCreate(input: ResolveSubscriberInput): Promise<Subscriber> {
    const channel = input.channel ?? "telegram";
    const existing = await this.repos.subscribers.findByExternal(
      input.botId,
      channel,
      input.externalUserId,
    );
    if (existing) {
      const touched: Subscriber = {
        ...existing,
        lastSeenAt: nowIso(),
        updatedAt: nowIso(),
        displayName: input.displayName?.trim() || existing.displayName,
      };
      await this.repos.subscribers.save(touched);
      return touched;
    }

    const ts = nowIso();
    const subscriber: Subscriber = {
      id: newSubscriberId(),
      botId: input.botId,
      channel,
      externalUserId: String(input.externalUserId),
      displayName: input.displayName?.trim() || `User ${input.externalUserId}`,
      locale: input.locale ?? "ru",
      status: "active",
      tags: Object.freeze([]),
      customFields: Object.freeze({}),
      attributes: Object.freeze({}),
      createdAt: ts,
      updatedAt: ts,
      lastSeenAt: ts,
    };
    await this.repos.subscribers.save(subscriber);
    await this.recordEvent(subscriber, SubscriberEventTypes.CREATED, {});
    return subscriber;
  }

  async updateStatus(id: string, status: SubscriberStatus): Promise<Subscriber | null> {
    const sub = await this.repos.subscribers.getById(id);
    if (!sub) return null;
    const next: Subscriber = { ...sub, status, updatedAt: nowIso() };
    await this.repos.subscribers.save(next);
    return next;
  }

  async ensureConversation(subscriber: Subscriber): Promise<Conversation> {
    const open = await this.repos.conversations.getOpenForSubscriber(subscriber.id);
    if (open) return open;

    const ts = nowIso();
    const conversation: Conversation = {
      id: newConversationId(),
      subscriberId: subscriber.id,
      botId: subscriber.botId,
      channel: subscriber.channel,
      status: "open",
      lastMessageAt: ts,
      currentExecutionId: null,
      metadata: Object.freeze({}),
      createdAt: ts,
      updatedAt: ts,
    };
    await this.repos.conversations.save(conversation);
    await this.recordEvent(subscriber, SubscriberEventTypes.CONVERSATION_OPENED, {
      conversationId: conversation.id,
    });
    return conversation;
  }

  async ensureSession(
    subscriber: Subscriber,
    conversation: Conversation,
    options: { flowId?: string; executionId?: string } = {},
  ): Promise<SubscriberSession> {
    const active = await this.repos.sessions.getActiveForSubscriber(subscriber.id);
    if (active) {
      const patched: SubscriberSession = {
        ...active,
        flowId: options.flowId ?? active.flowId,
        executionId: options.executionId ?? active.executionId,
        updatedAt: nowIso(),
      };
      await this.repos.sessions.save(patched);
      return patched;
    }

    const ts = nowIso();
    const session: SubscriberSession = {
      id: newSessionId(),
      subscriberId: subscriber.id,
      conversationId: conversation.id,
      botId: subscriber.botId,
      status: "active",
      flowId: options.flowId ?? null,
      executionId: options.executionId ?? null,
      variables: Object.freeze({}),
      startedAt: ts,
      updatedAt: ts,
      endedAt: null,
    };
    await this.repos.sessions.save(session);
    await this.recordEvent(subscriber, SubscriberEventTypes.SESSION_STARTED, {
      sessionId: session.id,
    });
    return session;
  }

  /**
   * Resolve full subscriber context for a flow run (center of ManyChat-style execution).
   */
  async resolveContext(
    input: ResolveSubscriberInput & { flowId?: string; executionId?: string },
  ): Promise<SubscriberContext> {
    const subscriber = await this.getOrCreate(input);
    const conversation = await this.ensureConversation(subscriber);
    const session = await this.ensureSession(subscriber, conversation, {
      flowId: input.flowId,
      executionId: input.executionId,
    });
    const variables = Object.freeze({
      ...session.variables,
      ...subscriber.customFields,
    });
    return Object.freeze({
      subscriber,
      conversation,
      session,
      variables,
    });
  }

  private async recordEvent(
    subscriber: Subscriber,
    type: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const event = Object.freeze({
      id: newEventId(),
      subscriberId: subscriber.id,
      botId: subscriber.botId,
      type,
      payload: Object.freeze({ ...payload }),
      occurredAt: nowIso(),
      source: "system" as const,
    });
    await this.repos.events.append(event);
    await this.bus.emit(event);
  }
}
