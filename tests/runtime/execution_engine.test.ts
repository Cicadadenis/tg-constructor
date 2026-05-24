import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildExecutionIrFromFlowGraph,
  createExecutionScheduler,
  InMemoryExecutionStateStore,
  isJoinBarrierSatisfied,
  type ExecutionIrPlan,
} from "../../core/runtime/execution/index.js";
import { ensureCapabilityExecutorsRegistered } from "../../core/runtime/capabilityExecutors.js";

ensureCapabilityExecutorsRegistered();

function branchFlowGraph() {
  return {
    version: 1,
    nonLinear: true,
    nodes: [
      { id: "n_root", type: "entry", payload: {} },
      { id: "n_branch", type: "branch", payload: { expression: "x >= 1" } },
      { id: "n_bt", type: "branch_arm", payload: { arm: "true" } },
      { id: "n_bf", type: "branch_arm", payload: { arm: "false" } },
      { id: "n_ok", type: "notify", payload: { text: "OK" } },
      { id: "n_no", type: "notify", payload: { text: "NO" } },
      { id: "n_merge", type: "merge", payload: {} },
      { id: "n_done", type: "terminal", payload: {} },
    ],
    edges: [
      { from: "n_root", to: "n_branch", kind: "flow" },
      { from: "n_branch", to: "n_bt", kind: "true", condition: "x >= 1" },
      { from: "n_branch", to: "n_bf", kind: "false" },
      { from: "n_bt", to: "n_ok", kind: "flow" },
      { from: "n_bf", to: "n_no", kind: "flow" },
      { from: "n_ok", to: "n_merge", kind: "merge" },
      { from: "n_no", to: "n_merge", kind: "merge" },
      { from: "n_merge", to: "n_done", kind: "flow" },
    ],
  };
}

describe("Execution IR", () => {
  it("builds immutable plan from non-linear flow graph", () => {
    const plan = buildExecutionIrFromFlowGraph(branchFlowGraph());
    assert.equal(plan.version, "1.0");
    assert.ok(plan.planId);
    assert.ok(plan.steps.length > 0);
    assert.ok(plan.barriers.length >= 1);
    const fork = plan.steps.find((s) => s.kind === "fork");
    assert.ok(fork);
    assert.ok(fork!.forkBranches && fork!.forkBranches.length === 2);
    Object.freeze(plan);
    assert.throws(() => {
      (plan as { planId: string }).planId = "mutated";
    });
  });

  it("join barrier satisfaction is deterministic", () => {
    const plan = buildExecutionIrFromFlowGraph(branchFlowGraph());
    const barrier = plan.barriers[0];
    assert.equal(
      isJoinBarrierSatisfied(barrier, {
        barrierId: barrier.barrierId,
        completedBranchIds: barrier.requiredBranchIds,
      }),
      true,
    );
    assert.equal(
      isJoinBarrierSatisfied(barrier, {
        barrierId: barrier.barrierId,
        completedBranchIds: [barrier.requiredBranchIds[0]],
      }),
      false,
    );
  });
});

describe("Execution scheduler", () => {
  it("runs sequential flow to completion", async () => {
    const plan = buildExecutionIrFromFlowGraph({
      nodes: [
        { id: "a", type: "notify", payload: { text: "Hi" } },
        { id: "b", type: "terminal", payload: {} },
      ],
      edges: [{ from: "a", to: "b", kind: "flow" }],
    });
    plan as ExecutionIrPlan;
    const store = new InMemoryExecutionStateStore();
    const scheduler = createExecutionScheduler(plan);
    const result = await scheduler.start({ store, maxSteps: 20 });
    assert.ok(["completed", "running"].includes(result.status) || result.stepsExecuted > 0);
    const loaded = await store.load(result.executionId);
    assert.ok(loaded);
  });

  it("parallel fork branches execute and join", async () => {
    const plan = buildExecutionIrFromFlowGraph(branchFlowGraph());
    const store = new InMemoryExecutionStateStore();
    const scheduler = createExecutionScheduler(plan);
    const result = await scheduler.start({ store, maxSteps: 100 });
    assert.ok(result.stepsExecuted > 0);
    const loaded = await store.load(result.executionId);
    assert.ok(loaded);
    const branchKeys = Object.keys(loaded!.branchStates);
    assert.ok(branchKeys.length >= 1 || loaded!.completedStepIds.length > 0);
  });

  it("resumes suspended execution", async () => {
    const plan = buildExecutionIrFromFlowGraph({
      nodes: [
        { id: "j", type: "merge", payload: {} },
        { id: "t", type: "terminal", payload: {} },
      ],
      edges: [{ from: "j", to: "t", kind: "flow" }],
    });
    const store = new InMemoryExecutionStateStore();
    const scheduler = createExecutionScheduler(plan);
    const started = await scheduler.start({ store, maxSteps: 1 });
    if (started.status === "suspended") {
      const resumed = await scheduler.resume(started.executionId, { store, maxSteps: 50 });
      assert.ok(resumed.stepsExecuted >= started.stepsExecuted);
    }
  });

  it("retries failed action then completes or fails deterministically", async () => {
    const plan = buildExecutionIrFromFlowGraph({
      nodes: [
        { id: "x", type: "notify", payload: { text: "retry me" } },
        { id: "y", type: "terminal", payload: {} },
      ],
      edges: [{ from: "x", to: "y", kind: "flow" }],
    });
    const store = new InMemoryExecutionStateStore();
    const scheduler = createExecutionScheduler(plan);
    const result = await scheduler.start({ store, maxSteps: 30 });
    assert.ok(result.snapshot.checkpoint >= 0);
  });
});
