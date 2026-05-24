import assert from "node:assert/strict";

import {
  botIRNodeToVisualDb,
  buildVisualDbGraphFromBotNodes,
  isDbNodeType,
} from "../../core/db/visual_db_ir";
import { graphToBotIR } from "../../core/ir/bot_ir";
import { buildExecutionGraph } from "../../core/execution/buildExecutionGraph";
import { generateAiogramBot } from "../../generators/python_aiogram/generateBot";
import { buildPythonModule } from "../../core/codegen/compileCore.js";
import "../../core/codegen/index.js";

assert.ok(isDbNodeType("db.get"));
assert.equal(isDbNodeType("message"), false);

const visual = botIRNodeToVisualDb({
  id: "db1",
  type: "db.get",
  payload: { key: "username", varname: "uname" },
});
assert.ok(visual);
assert.equal(visual!.key, "username");
assert.equal(visual!.varname, "uname");

const graph = buildVisualDbGraphFromBotNodes([
  { id: "db1", type: "db.set", payload: { key: "k", value: "v" } },
  { id: "msg", type: "message", payload: { text: "hi" } },
]);
assert.equal(graph.nodeCount, 1);
assert.equal(graph.nodes[0]!.type, "db.set");

const botIr = graphToBotIR({
  nodes: [
    {
      id: "start_1",
      type: "start",
      position: { x: 0, y: 0 },
      data: { cmd: "start" },
    },
    {
      id: "db_1",
      type: "db.get",
      position: { x: 0, y: 120 },
      data: { key: "score", varname: "score" },
    },
  ],
  edges: [
    {
      id: "e1",
      source: "start_1",
      target: "db_1",
      sourcePort: "flow",
      targetPort: "flow",
    },
  ],
});
assert.equal(botIr.visualDb.nodeCount, 1);
assert.equal(botIr.context.dbNodeCount, 1);

const execution = buildExecutionGraph(
  [
    { id: "s1", type: "start", data: { cmd: "start" } },
    { id: "db1", type: "db.get", data: { key: "x", varname: "x" } },
  ],
  [{ source: "s1", target: "db1", sourceHandle: "flow", targetHandle: "flow" }],
);

const scaffold = generateAiogramBot(execution);
assert.match(scaffold, /# --- Visual DB IR ---/);
assert.match(scaffold, /async def db_get/);
assert.match(scaffold, /import aiosqlite/);

const stacks = [
  {
    blocks: [
      { id: "start1", type: "start", props: { cmd: "start" } },
      { id: "db1", type: "db.get", props: { key: "user", varname: "user" } },
      { id: "msg1", type: "message", props: { text: "ok" } },
    ],
  },
];
const python = buildPythonModule(stacks);
assert.match(python, /aiosqlite/);
assert.match(python, /await db_get/);

console.log("visual_db test OK");
