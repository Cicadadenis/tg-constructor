import type { ExecutionContext } from "../executionContext.js";

export type ExecutionEffectType = "setState" | "sendMessage" | "callAPI" | "emitEvent";

export interface SetStateEffect {
  readonly type: "setState";
  readonly vars?: Readonly<Record<string, unknown>>;
  readonly state?: unknown;
}

export interface SendMessageEffect {
  readonly type: "sendMessage";
  readonly text: string;
  readonly parseMode?: string;
  readonly replyMarkup?: unknown;
}

export interface CallAPIEffect {
  readonly type: "callAPI";
  readonly method: string;
  readonly url?: string;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

export interface EmitEventEffect {
  readonly type: "emitEvent";
  readonly eventType: string;
  readonly payload?: Readonly<Record<string, unknown>>;
}

export type ExecutionEffect =
  | SetStateEffect
  | SendMessageEffect
  | CallAPIEffect
  | EmitEventEffect;

export interface ApplyExecutionEffectsOptions {
  replayOnly?: boolean;
  onEmitEvent?: (effect: EmitEventEffect) => void | Promise<void>;
}

export {
  freezeEffects,
  effects,
  setStateEffect,
  sendMessageEffect,
  callAPIEffect,
  emitEventEffect,
  applyExecutionEffects,
} from "./executionEffects.mjs";
