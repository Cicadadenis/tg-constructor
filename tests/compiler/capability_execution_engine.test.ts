import assert from "node:assert/strict";

import { createGraphDocument } from "../../src/constructor/graph_document/graph_document.js";
import { buildGraphNodeData } from "../../src/constructor/graph_document/graph_node_payload.js";
import { graphToBotIR } from "../../core/ir/bot_ir";
import { buildExecutionPlan } from "../../core/runtime/executionPlan.ts";
import { execute } from "../../core/runtime/runtimeEngine.ts";
import { ensureCapabilityExecutorsRegistered } from "../../core/runtime/capabilityExecutors.ts";
import { resolveNodeCapability } from "../../core/capabilities/resolveNodeCapability.ts";
import { compileEventDecorator } from "../../core/codegen/compileCore.js";
import { registerAllCapabilityEmitters } from "../../core/codegen/capabilityEmitters/registerAll.js";
import { compileViaCapabilities } from "../../core/compiler/capabilityCompilePipeline.ts";
import { CAPABILITY_ACTIONS } from "../../core/capabilities/capabilityIds.ts";

registerAllCapabilityEmitters();
ensureCapabilityExecutorsRegistered();

const doc = createGraphDocument({
  schema_version: 2,
  nodes: [
    {
      id: "s1",
      type: "start",
      position: { x: 0, y: 0 },
      data: buildGraphNodeData("start", { cmd: "start" }),
    },
    {
      id: "m1",
      type: "message",
      position: { x: 200, y: 0 },
      data: buildGraphNodeData("message", { text: "Hi" }),
    },
    {
      id: "stop1",
      type: "stop",
      position: { x: 400, y: 0 },
      data: buildGraphNodeData("stop", {}),
    },
  ],
  edges: [
    {
      id: "e1",
      source: "s1",
      target: "m1",
      sourcePort: "flow",
      targetPort: "flow",
    },
    {
      id: "e2",
      source: "m1",
      target: "stop1",
      sourcePort: "flow",
      targetPort: "flow",
    },
  ],
});

const ir = graphToBotIR(doc);
const plan = buildExecutionPlan(ir);

assert.equal(plan.steps.length, 3);
assert.ok(Object.isFrozen(plan));
assert.ok(Object.isFrozen(plan.steps));

const startStep = plan.steps.find((s) => s.nodeId === "s1");
assert.equal(startStep?.capabilityId, "route");
assert.ok(startStep?.triggerIds.includes("telegram.command.start"));

const msgStep = plan.steps.find((s) => s.nodeId === "m1");
assert.equal(msgStep?.capabilityId, CAPABILITY_ACTIONS.SEND_MESSAGE);

const caps = resolveNodeCapability("message", { nodeId: "m1" });
assert.equal(caps.primaryAction, "send_message");
assert.ok(!("type" in (ir.nodes.find((n) => n.id === "m1")?.payload || {})));

const decorator = compileEventDecorator("start", { cmd: "start" }, {});
assert.ok(decorator.includes("CommandStart"));

const runtime = {
  user: { id: 1 },
  message: { text: "x" },
  callback: null,
  state: null,
  vars: {},
};

const sent = await execute(CAPABILITY_ACTIONS.SEND_MESSAGE, runtime, {
  text: "hello",
});
assert.equal(sent.ok, true);

runtime.vars.seed = 1;
const setVar = await execute(CAPABILITY_ACTIONS.CTX_SET_VAR, runtime, {
  varname: "a",
  value: 42,
});
assert.equal(setVar.ok, true);
assert.equal(runtime.vars.a, 42);

const compiled = compileViaCapabilities(doc, { skipValidation: true });
assert.equal(compiled.success, true);
assert.ok(compiled.executionPlan.steps.length === 3);
assert.ok(compiled.python.includes("aiogram"));

console.log("capability_execution_engine.test.ts OK");
