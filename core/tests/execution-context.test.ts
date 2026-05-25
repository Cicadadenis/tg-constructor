import assert from "node:assert/strict";
import { describe, it } from "node:test";

import "../node_manifest/init.mjs";
import { applyExecutionEffects } from "../runtime/execution/executionEffects.js";
import {
  bindNodeScope,
  bindRunScope,
  createExecutionContext,
  getPayload,
  getVar,
} from "../runtime/executionContext.js";
import { InMemoryExecutionDb } from "../runtime/executionDb.js";
import {
  executeCapability,
  ensureCapabilityExecutorsRegistered,
} from "../runtime/capabilityExecutors.js";
import { CAPABILITY_ACTIONS } from "../capabilities/capabilityIds.mjs";
import { registerTelegramTransport } from "../transport/telegramAdapter.js";
import { createTransport } from "../transport/transportAdapter.js";

registerTelegramTransport();
ensureCapabilityExecutorsRegistered();

describe("ExecutionContext kernel", () => {
  it("exposes user, chat, message, state, vars, temp, db, logger, traceId", () => {
    const db = new InMemoryExecutionDb();
    const ctx = createExecutionContext({
      traceId: "trace-1",
      user: { id: 1 },
      chat: { id: 99 },
      message: { text: "hi" },
      vars: { x: 1 },
      db,
    });
    assert.equal(ctx.traceId, "trace-1");
    assert.equal(ctx.vars.x, 1);
    assert.ok(ctx.logger);
    assert.equal(ctx.db, db);
    assert.deepEqual(ctx.temp, {});
  });

  it("capability executors return effects; engine applies sendMessage", async () => {
    const ctx = createExecutionContext({ traceId: "t2", vars: {}, message: {} });
    bindRunScope(ctx, { transport: createTransport("telegram") });
    bindNodeScope(ctx, {
      payload: { text: "hello" },
      nodeId: "n1",
      stepId: "s1",
      blockType: "message",
    });
    const result = await executeCapability(CAPABILITY_ACTIONS.SEND_MESSAGE, ctx);
    assert.equal(result.ok, true);
    assert.equal(result.effects[0]?.type, "sendMessage");
    await applyExecutionEffects(ctx, result.effects);
    assert.equal(getPayload(ctx).text, "hello");
  });

  it("vars update via setState effects only", async () => {
    const ctx = createExecutionContext({ traceId: "t3", vars: {} });
    bindNodeScope(ctx, {
      payload: { varname: "name", value: "Ada" },
      blockType: "remember",
    });
    const result = await executeCapability(CAPABILITY_ACTIONS.CTX_SET_VAR, ctx);
    await applyExecutionEffects(ctx, result.effects);
    assert.equal(getVar(ctx, "name"), "Ada");
  });
});
