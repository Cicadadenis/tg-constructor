import assert from "node:assert/strict";

import { buildFsmGraph, FSM_STATE_TYPE, FSM_INPUT_TYPE } from "../../core/execution/fsmGraph";
import { buildFSM } from "../../core/execution/buildFSM";
import { buildExecutionGraph } from "../../core/execution/buildExecutionGraph";
import { generateAiogramBot } from "../../generators/python_aiogram/generateBot";

const execution = buildExecutionGraph(
  [
    {
      id: "s1",
      type: FSM_STATE_TYPE,
      data: { group: "Profile", name: "start" },
    },
    {
      id: "in1",
      type: FSM_INPUT_TYPE,
      data: { group: "Profile", field: "name", prompt: "Name?" },
    },
    {
      id: "s2",
      type: FSM_STATE_TYPE,
      data: { group: "Profile", name: "done" },
    },
  ],
  [
    { source: "s1", target: "in1", sourceHandle: "flow", targetHandle: "flow" },
    { source: "in1", target: "s2", sourceHandle: "flow", targetHandle: "flow" },
  ],
);

const fsmGraph = buildFsmGraph(execution);

assert.equal(fsmGraph.states.length, 2);
assert.equal(fsmGraph.inputs.length, 1);
assert.ok(fsmGraph.transitions.length >= 2);

const flat = buildFSM(execution);
assert.ok(flat.some((t) => t.from === "s1" && t.to === "in1"));

const python = generateAiogramBot(execution);
assert.match(python, /# FSM_STATE s1/);
assert.match(python, /# FSM_INPUT in1/);
assert.match(python, /# FSM_TRANSITION/);
assert.match(python, /class Profile\(StatesGroup\):/);

console.log("fsmGraph test OK");
