/**
 * Transport abstraction — Telegram is one adapter implementation.
 */

import type { ExecutionContext } from "../runtime/executionContext.js";

export interface SendMessageOptions {
  parseMode?: string;
  replyMarkup?: unknown;
}

export interface TransportSendResult {
  ok: boolean;
  transportId: string;
  messageId?: string | number;
}

/** Platform-agnostic transport surface for capability executors. */
export interface TransportAdapter {
  readonly id: string;
  sendMessage(
    ctx: ExecutionContext,
    text: string,
    options?: SendMessageOptions,
  ): Promise<TransportSendResult>;
  answerCallback?(
    ctx: ExecutionContext,
    text?: string,
  ): Promise<TransportSendResult>;
  editMessage?(
    ctx: ExecutionContext,
    text: string,
  ): Promise<TransportSendResult>;
  chatAction?(
    ctx: ExecutionContext,
    action: string,
  ): Promise<TransportSendResult>;
}

export type TransportFactory = () => TransportAdapter;

const transports = new Map<string, TransportFactory>();

export function registerTransport(
  id: string,
  factory: TransportFactory,
): void {
  const key = String(id || "").trim();
  if (!key || typeof factory !== "function") {
    throw new Error("registerTransport(id, factory) requires id and factory");
  }
  transports.set(key, factory);
}

export function createTransport(id: string): TransportAdapter {
  const key = String(id || "").trim();
  const factory = transports.get(key);
  if (!factory) {
    throw new Error(`Unknown transport: "${key}"`);
  }
  return factory();
}

export function listTransports(): string[] {
  return [...transports.keys()].sort();
}
