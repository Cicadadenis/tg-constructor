/**
 * Telegram transport adapter (dry-run / preview / test harness).
 */

import type { BotRuntimeContext } from "../runtime/runtimeContext.js";
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

export class TelegramTransportAdapter implements TransportAdapter {
  readonly id = TELEGRAM_TRANSPORT_ID;

  async sendMessage(
    ctx: BotRuntimeContext,
    text: string,
  ): Promise<TransportSendResult> {
    const target = ctx.callback?.message ?? ctx.message;
    if (target && typeof target === "object") {
      (target as Record<string, unknown>)._lastText = text;
    }
    return ok();
  }

  async answerCallback(
    ctx: BotRuntimeContext,
    text?: string,
  ): Promise<TransportSendResult> {
    if (ctx.callback && typeof ctx.callback === "object" && text) {
      (ctx.callback as Record<string, unknown>)._answer = text;
    }
    return ok();
  }

  async editMessage(
    ctx: BotRuntimeContext,
    text: string,
  ): Promise<TransportSendResult> {
    const msg = ctx.callback?.message ?? ctx.message;
    if (msg && typeof msg === "object") {
      (msg as Record<string, unknown>).text = text;
    }
    return ok();
  }

  async chatAction(
    _ctx: BotRuntimeContext,
    action: string,
  ): Promise<TransportSendResult> {
    return ok({ messageId: action });
  }
}

export function registerTelegramTransport(): void {
  registerTransport(TELEGRAM_TRANSPORT_ID, () => new TelegramTransportAdapter());
}

registerTelegramTransport();
