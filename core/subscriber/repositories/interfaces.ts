import type {
  AudienceSegment,
  Conversation,
  CustomFieldDefinition,
  Subscriber,
  SubscriberEventRecord,
  SubscriberSession,
  TagDefinition,
} from "../entities/types.js";

export interface SubscriberRepository {
  getById(id: string): Promise<Subscriber | null>;
  findByExternal(botId: string, channel: string, externalUserId: string): Promise<Subscriber | null>;
  save(subscriber: Subscriber): Promise<void>;
  listByBot(botId: string): Promise<readonly Subscriber[]>;
}

export interface ConversationRepository {
  getById(id: string): Promise<Conversation | null>;
  getOpenForSubscriber(subscriberId: string): Promise<Conversation | null>;
  save(conversation: Conversation): Promise<void>;
}

export interface SessionRepository {
  getById(id: string): Promise<SubscriberSession | null>;
  getActiveForSubscriber(subscriberId: string): Promise<SubscriberSession | null>;
  save(session: SubscriberSession): Promise<void>;
}

export interface TagRepository {
  getDefinition(botId: string, name: string): Promise<TagDefinition | null>;
  saveDefinition(tag: TagDefinition): Promise<void>;
  listDefinitions(botId: string): Promise<readonly TagDefinition[]>;
}

export interface CustomFieldRepository {
  getDefinition(botId: string, key: string): Promise<CustomFieldDefinition | null>;
  saveDefinition(field: CustomFieldDefinition): Promise<void>;
  listDefinitions(botId: string): Promise<readonly CustomFieldDefinition[]>;
}

export interface EventRepository {
  append(event: SubscriberEventRecord): Promise<void>;
  listForSubscriber(subscriberId: string, limit?: number): Promise<readonly SubscriberEventRecord[]>;
}

export interface SegmentRepository {
  getById(id: string): Promise<AudienceSegment | null>;
  save(segment: AudienceSegment): Promise<void>;
  listByBot(botId: string): Promise<readonly AudienceSegment[]>;
}

export interface SubscriberRepositories {
  subscribers: SubscriberRepository;
  conversations: ConversationRepository;
  sessions: SessionRepository;
  tags: TagRepository;
  customFields: CustomFieldRepository;
  events: EventRepository;
  segments: SegmentRepository;
}
