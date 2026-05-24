export {
  registerTransport,
  createTransport,
  listTransports,
  type TransportAdapter,
  type TransportSendResult,
  type SendMessageOptions,
} from "./transportAdapter.js";

export {
  TELEGRAM_TRANSPORT_ID,
  TelegramTransportAdapter,
  registerTelegramTransport,
} from "./telegramAdapter.js";
