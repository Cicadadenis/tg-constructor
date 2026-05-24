import test from "node:test";
import assert from "node:assert/strict";

import { blockRegistry, getBlockDefinition, getNodeCapabilities } from "../blockRegistry.js";
import {
  getBlockCapabilities,
  isAllowedSourcePort,
  blockCapabilitiesByType,
} from "../registry/blockCapabilities.js";
import { canConnect } from "../../src/constructor/graph_document/operation_registry.js";

test("every blockRegistry type has nodeCapabilities attached", () => {
  for (const def of Object.values(blockRegistry)) {
    assert.ok(def.nodeCapabilities, `${def.type}: missing nodeCapabilities`);
    assert.equal(
      def.nodeCapabilities,
      getBlockCapabilities(def.type),
      `${def.type}: nodeCapabilities mismatch`,
    );
  }
});

test("condition branch outputs are capability-gated", () => {
  const caps = getBlockCapabilities("condition");
  assert.deepEqual(caps.outputs, ["true", "false"]);
  assert.ok(isAllowedSourcePort("condition", "true"));
  assert.ok(!isAllowedSourcePort("condition", "flow"));
});

test("canConnect rejects invalid capability output port", () => {
  const bad = canConnect("condition", "message", "flow", "flow");
  assert.equal(bad.ok, false);
  assert.match(String(bad.reason || ""), /not allowed/i);
});

test("getNodeCapabilities matches registry attachment", () => {
  const caps = getNodeCapabilities("message");
  assert.deepEqual(caps.actions, ["send_message"]);
  assert.equal(getBlockDefinition("message")?.nodeCapabilities, caps);
});

test("blockCapabilitiesByType covers palette block types", () => {
  assert.ok(blockCapabilitiesByType.start);
  assert.ok(blockCapabilitiesByType.message);
  assert.equal(blockCapabilitiesByType.goto.outputs.length, 0);
});
