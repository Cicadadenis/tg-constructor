import type { ExecutionContext } from "../../runtime/executionContext.js";

export interface TelegramIdentity {
  channel: string;
  externalUserId: string | null;
  displayName?: string;
  locale?: string;
  chatId?: string;
}

/**
 * Extract Telegram user/chat identity from execution context (preview + live).
 */
export function extractTelegramIdentity(ctx: ExecutionContext): TelegramIdentity {
  const user = ctx.user as { id?: number | string; first_name?: string; username?: string; language_code?: string } | null;
  const chat = ctx.chat as { id?: number | string; type?: string } | null;
  const message = ctx.message as { from?: { id?: number }; chat?: { id?: number } } | null;

  const externalUserId =
    user?.id != null
      ? String(user.id)
      : message?.from?.id != null
        ? String(message.from.id)
        : null;

  const chatId =
    chat?.id != null
      ? String(chat.id)
      : message?.chat?.id != null
        ? String(message.chat.id)
        : undefined;

  const displayName = user?.first_name
    ? [user.first_name, (user as { last_name?: string }).last_name].filter(Boolean).join(" ")
    : user?.username
      ? `@${user.username}`
      : undefined;

  return {
    channel: "telegram",
    externalUserId,
    displayName,
    locale: user?.language_code ?? "ru",
    chatId,
  };
}
