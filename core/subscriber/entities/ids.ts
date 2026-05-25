import { randomUUID } from "node:crypto";

export function newSubscriberId(): string {
  return `sub_${randomUUID()}`;
}

export function newConversationId(): string {
  return `conv_${randomUUID()}`;
}

export function newSessionId(): string {
  return `sess_${randomUUID()}`;
}

export function newTagId(): string {
  return `tag_${randomUUID()}`;
}

export function newCustomFieldId(): string {
  return `cf_${randomUUID()}`;
}

export function newEventId(): string {
  return `evt_${randomUUID()}`;
}

export function newSegmentId(): string {
  return `seg_${randomUUID()}`;
}
