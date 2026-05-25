import type { Conversation, Subscriber, SubscriberSession } from "../entities/types.js";
import { SubscriberService } from "./subscriberService.js";
import type { SubscriberRepositories } from "../repositories/interfaces.js";
import { getDefaultSubscriberRepositories } from "../repositories/inMemoryRepositories.js";

export class SessionService {
  constructor(
    private readonly subscribers = new SubscriberService(),
    private readonly repos: SubscriberRepositories = getDefaultSubscriberRepositories(),
  ) {}

  async start(
    subscriber: Subscriber,
    conversation: Conversation,
    options: { flowId?: string; executionId?: string } = {},
  ): Promise<SubscriberSession> {
    return this.subscribers.ensureSession(subscriber, conversation, options);
  }

  async end(session: SubscriberSession): Promise<SubscriberSession> {
    const next: SubscriberSession = {
      ...session,
      status: "ended",
      endedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.repos.sessions.save(next);
    return next;
  }
}
