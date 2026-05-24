/**
 * Telegram transport adapter (dry-run / preview / test harness).
 */

import type { ExecutionContext } from "../runtime/executionContext.js";
import { getCallback } from "../runtime/executionContext.js";
import {
  registerTransport,
  type TransportAdapter,
  type TransportSendResult,
} from "./transportAdapter.js";

export const TELEGRAM_TRANSPORT_ID = "telegram";

function ok(partial: Partial<TransportSendResult> = {}): TransportSendResult {
  return {
    ok: true,
    transportId: TELEGRAM_TRANSPORT_ID,
    ...partial,
  };
}

function callbackMessage(ctx: ExecutionContext): unknown {
  const callback = getCallback(ctx);
  if (callback && typeof callback === "object" && "message" in callback) {
    return (callback as { message?: unknown }).message;
  }
  return null;
}

export class TelegramTransportAdapter implements TransportAdapter {
  readonly id = TELEGRAM_TRANSPORT_ID;

  async sendMessage(
    ctx: ExecutionContext,
    text: string,
  ): Promise<TransportSendResult> {
    const target = callbackMessage(ctx) ?? ctx.message;
    if (target && typeof target === "object") {
      (target as Record<string, unknown>)._lastText = text;
    }
    return ok();
  }

  async answerCallback(
    ctx: ExecutionContext,
    text?: string,
  ): Promise<TransportSendResult> {
    const callback = getCallback(ctx);
    if (callback && typeof callback === "object" && text) {
      (callback as Record<string, unknown>)._answer = text;
    }
    return ok();
  }

  async editMessage(
    ctx: ExecutionContext,
    text: string,
  ): Promise<TransportSendResult> {
    const msg = callbackMessage(ctx) ?? ctx.message;
    if (msg && typeof msg === "object") {
      (msg as Record<string, unknown>).text = text;
    }
    return ok();
  }

  async chatAction(
    _ctx: ExecutionContext,
    action: string,
  ): Promise<TransportSendResult> {
    return ok({ messageId: action });
  }
}

export function registerTelegramTransport(): void {
  registerTransport(TELEGRAM_TRANSPORT_ID, () => new TelegramTransportAdapter());
}

registerTelegramTransport();
