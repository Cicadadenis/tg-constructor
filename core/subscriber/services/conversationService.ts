import type { Conversation, Subscriber } from "../entities/types.js";
import type { SubscriberRepositories } from "../repositories/interfaces.js";
import { getDefaultSubscriberRepositories } from "../repositories/inMemoryRepositories.js";
import { SubscriberService } from "./subscriberService.js";

/** Conversation lifecycle (ManyChat thread per subscriber). */
export class ConversationService {
  constructor(
    private readonly subscribers = new SubscriberService(),
    private readonly repos: SubscriberRepositories = getDefaultSubscriberRepositories(),
  ) {}

  async open(subscriber: Subscriber): Promise<Conversation> {
    return this.subscribers.ensureConversation(subscriber);
  }

  async close(conversation: Conversation): Promise<Conversation> {
    const next: Conversation = {
      ...conversation,
      status: "closed",
      updatedAt: new Date().toISOString(),
    };
    await this.repos.conversations.save(next);
    return next;
  }

  async linkExecution(conversation: Conversation, executionId: string): Promise<Conversation> {
    const next: Conversation = {
      ...conversation,
      currentExecutionId: executionId,
      lastMessageAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.repos.conversations.save(next);
    return next;
  }
}
