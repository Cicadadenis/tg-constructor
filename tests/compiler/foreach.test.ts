import assert from "node:assert/strict";

import { emitForeachInlineKeyboard, isForeachKeyboardOutput } from "../../core/codegen/foreachCodegen.js";
import { buildExecutionGraph } from "../../core/execution/buildExecutionGraph";
import { generateAiogramBot } from "../../generators/python_aiogram/generateBot";
import { buildPythonModule } from "../../core/codegen/compileCore.js";
import "../../core/codegen/index.js";

assert.ok(isForeachKeyboardOutput({ output: "inline_keyboard" }));
assert.equal(isForeachKeyboardOutput({ output: "body" }), false);

const inlinePy = emitForeachInlineKeyboard({
  list: "products",
  var: "product",
  labelField: "name",
  idField: "id",
  callbackPrefix: "prod:",
  columns: 2,
});
assert.match(inlinePy, /for product in products/);
assert.match(inlinePy, /InlineKeyboardButton/);
assert.match(inlinePy, /prod:/);

const execution = buildExecutionGraph(
  [
    { id: "s1", type: "start", data: { cmd: "start" } },
    {
      id: "fe1",
      type: "foreach",
      data: { list: "products", var: "product", output: "inline_keyboard" },
    },
  ],
  [{ source: "s1", target: "fe1", sourceHandle: "flow", targetHandle: "flow" }],
);
const scaffold = generateAiogramBot(execution);
assert.match(scaffold, /# FOREACH fe1/);
assert.match(scaffold, /list=products/);

const stacks = [
  {
    blocks: [
      { id: "start1", type: "start", props: { cmd: "start" } },
      {
        id: "fe1",
        type: "foreach",
        props: {
          list: "products",
          var: "product",
          output: "inline_keyboard",
          labelField: "name",
          idField: "id",
          callbackPrefix: "prod:",
        },
      },
      { id: "msg1", type: "message", props: { text: "Choose:" } },
    ],
  },
];
const python = buildPythonModule(stacks);
assert.match(python, /for product in products/);
assert.match(python, /InlineKeyboardMarkup/);
assert.match(python, /Choose:/);

const bodyStacks = [
  {
    blocks: [
      { id: "start1", type: "start", props: { cmd: "start" } },
      { id: "fe1", type: "foreach", props: { list: "items", var: "item", output: "body" } },
      { id: "log1", type: "log", props: { message: "x" } },
    ],
  },
];
const bodyPy = buildPythonModule(bodyStacks);
assert.match(bodyPy, /for item in items:/);

console.log("foreach test OK");
