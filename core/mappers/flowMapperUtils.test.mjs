import assert from "node:assert/strict";
import {
  buildCanonicalFlowEdgeId,
  sanitizeFlowPosition,
} from "./flowMapperUtils.ts";

assert.deepEqual(sanitizeFlowPosition({ x: NaN, y: Infinity }), { x: 0, y: 0 });
assert.deepEqual(sanitizeFlowPosition({ x: 10, y: 20 }), { x: 10, y: 20 });

const id1 = buildCanonicalFlowEdgeId({
  source: "a",
  target: "b",
  sourceHandle: "yes",
  targetHandle: "flow",
});
const id2 = buildCanonicalFlowEdgeId({
  source: "a",
  target: "b",
  sourceHandle: "no",
  targetHandle: "flow",
});
assert.notEqual(id1, id2);

console.log("flowMapperUtils.test.mjs: ok");
