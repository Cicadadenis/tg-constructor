/**
 * ManyChat-style subscriber domain entities (editor/runtime CRM layer).
 * GraphDocument node types are unchanged — this layer wraps per-chat state.
 */

export type SubscriberStatus = "active" | "unsubscribed" | "blocked";

export type ConversationStatus = "open" | "closed" | "archived";

export type SessionStatus = "active" | "idle" | "ended";

export type CustomFieldType = "text" | "number" | "boolean" | "date" | "json";

export interface Subscriber {
  readonly id: string;
  readonly botId: string;
  readonly channel: string;
  readonly externalUserId: string;
  displayName: string;
  locale: string;
  status: SubscriberStatus;
  readonly tags: readonly string[];
  readonly customFields: Readonly<Record<string, unknown>>;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
}

export interface Conversation {
  readonly id: string;
  readonly subscriberId: string;
  readonly botId: string;
  readonly channel: string;
  status: ConversationStatus;
  lastMessageAt: string;
  currentExecutionId: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
  updatedAt: string;
}

export interface SubscriberSession {
  readonly id: string;
  readonly subscriberId: string;
  readonly conversationId: string;
  readonly botId: string;
  status: SessionStatus;
  readonly flowId: string | null;
  readonly executionId: string | null;
  readonly variables: Readonly<Record<string, unknown>>;
  readonly startedAt: string;
  updatedAt: string;
  endedAt: string | null;
}

export interface TagDefinition {
  readonly id: string;
  readonly botId: string;
  name: string;
  color: string;
  readonly createdAt: string;
}

export interface CustomFieldDefinition {
  readonly id: string;
  readonly botId: string;
  key: string;
  label: string;
  type: CustomFieldType;
  defaultValue: unknown;
  readonly createdAt: string;
}

export interface SubscriberEventRecord {
  readonly id: string;
  readonly subscriberId: string;
  readonly botId: string;
  type: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly occurredAt: string;
  readonly source: "flow" | "api" | "system" | "trigger";
}

export interface AudienceSegment {
  readonly id: string;
  readonly botId: string;
  name: string;
  description: string;
  readonly filter: SegmentFilter;
  readonly createdAt: string;
  updatedAt: string;
}

/** Segment filter AST — evaluated by segmentation engine. */
export type SegmentFilter =
  | { op: "and"; clauses: readonly SegmentFilter[] }
  | { op: "or"; clauses: readonly SegmentFilter[] }
  | { op: "not"; clause: SegmentFilter }
  | { op: "hasTag"; tag: string }
  | { op: "missingTag"; tag: string }
  | { op: "fieldEq"; field: string; value: unknown }
  | { op: "fieldContains"; field: string; substring: string }
  | { op: "attrEq"; key: string; value: unknown }
  | { op: "statusEq"; status: SubscriberStatus }
  | { op: "eventOccurred"; eventType: string; withinHours?: number }
  | { op: "variableEq"; key: string; value: unknown }
  | { op: "variableContains"; key: string; substring: string }
  | { op: "fieldGt"; field: string; value: number }
  | { op: "fieldLt"; field: string; value: number }
  | { op: "hasAnyTag"; tags: readonly string[] }
  | { op: "inSegment"; segmentId: string }
  | { op: "dynamicExpr"; expression: string };

export interface SubscriberVariableScope {
  readonly subscriberId: string;
  readonly sessionId: string | null;
  readonly values: Readonly<Record<string, unknown>>;
}

export interface SubscriberContext {
  readonly subscriber: Subscriber;
  readonly conversation: Conversation;
  readonly session: SubscriberSession;
  readonly variables: Readonly<Record<string, unknown>>;
}
