import assert from "node:assert/strict";
import { describe, it } from "node:test";

import "../node_manifest/init.mjs";
import {
  applyExecutionEffects,
  emitEventEffect,
  sendMessageEffect,
  setStateEffect,
} from "../runtime/execution/executionEffects.js";
import {
  bindNodeScope,
  bindRunScope,
  createExecutionContext,
  getVar,
} from "../runtime/executionContext.js";
import {
  executeCapability,
  ensureCapabilityExecutorsRegistered,
} from "../runtime/capabilityExecutors.js";
import { CAPABILITY_ACTIONS } from "../capabilities/capabilityIds.mjs";
import { registerTelegramTransport } from "../transport/telegramAdapter.js";
import { createTransport } from "../transport/transportAdapter.js";

registerTelegramTransport();
ensureCapabilityExecutorsRegistered();

describe("execution effect system", () => {
  it("applyExecutionEffects applies setState without node mutation", async () => {
    const ctx = createExecutionContext({ traceId: "e1", vars: { a: 1 } });
    await applyExecutionEffects(ctx, [setStateEffect({ b: 2 })]);
    assert.equal(getVar(ctx, "a"), 1);
    assert.equal(getVar(ctx, "b"), 2);
  });

  it("executeCapability returns effects; vars change only after apply", async () => {
    const ctx = createExecutionContext({ traceId: "e2", vars: {} });
    bindRunScope(ctx, { transport: createTransport("telegram") });
    bindNodeScope(ctx, {
      payload: { varname: "name", value: "Ada" },
      blockType: "remember",
    });
    const pending = await executeCapability(CAPABILITY_ACTIONS.CTX_SET_VAR, ctx);
    assert.equal(getVar(ctx, "name"), undefined);
    assert.equal(pending.effects.length, 1);
    assert.equal(pending.effects[0]?.type, "setState");
    await applyExecutionEffects(ctx, pending.effects);
    assert.equal(getVar(ctx, "name"), "Ada");
  });

  it("sendMessage effect is deferred until apply", async () => {
    const ctx = createExecutionContext({
      traceId: "e3",
      message: { text: "before" },
    });
    bindRunScope(ctx, { transport: createTransport("telegram") });
    await applyExecutionEffects(ctx, [sendMessageEffect("hello")]);
    assert.equal((ctx.message as { _lastText?: string })._lastText, "hello");
  });

  it("emitEvent effect routes through onEmitEvent hook", async () => {
    const ctx = createExecutionContext({ traceId: "e4" });
    const seen: string[] = [];
    await applyExecutionEffects(
      ctx,
      [emitEventEffect("custom.event", { foo: "bar" })],
      {
        onEmitEvent: async (effect) => {
          seen.push(effect.eventType);
        },
      },
    );
    assert.deepEqual(seen, ["custom.event"]);
  });
});
