import { newSegmentId } from "../entities/ids.js";
import type { AudienceSegment, SegmentFilter, Subscriber } from "../entities/types.js";
import {
  evaluateSegmentFilter,
  filterSubscribersForSegment,
} from "../segmentation/segmentEngine.js";
import type { SubscriberRepositories } from "../repositories/interfaces.js";
import { getDefaultSubscriberRepositories } from "../repositories/inMemoryRepositories.js";
import { EventService } from "./eventService.js";

export class SegmentService {
  constructor(
    private readonly repos: SubscriberRepositories = getDefaultSubscriberRepositories(),
    private readonly events = new EventService(repos),
  ) {}

  async create(
    botId: string,
    name: string,
    filter: SegmentFilter,
    description = "",
  ): Promise<AudienceSegment> {
    const ts = new Date().toISOString();
    const segment: AudienceSegment = {
      id: newSegmentId(),
      botId,
      name,
      description,
      filter: Object.freeze(filter),
      createdAt: ts,
      updatedAt: ts,
    };
    await this.repos.segments.save(segment);
    return segment;
  }

  async evaluateForSubscriber(
    segment: AudienceSegment,
    subscriber: Subscriber,
  ): Promise<boolean> {
    const evts = await this.events.list(subscriber.id, 50);
    return evaluateSegmentFilter(segment.filter, {
      subscriber,
      events: evts,
    });
  }

  async resolveMembers(segment: AudienceSegment): Promise<Subscriber[]> {
    const all = await this.repos.subscribers.listByBot(segment.botId);
    return filterSubscribersForSegment(all, segment.filter, (subscriber) => ({
      subscriber,
    }));
  }

  async listByBot(botId: string): Promise<readonly AudienceSegment[]> {
    return this.repos.segments.listByBot(botId);
  }
}
