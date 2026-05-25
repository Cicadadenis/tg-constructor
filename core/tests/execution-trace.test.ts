import assert from "node:assert/strict";
import { describe, it } from "node:test";

import "../node_manifest/init.mjs";
import { compileFlowGraphToExecutionIr } from "../ai/executionGraphCompiler.mjs";
import {
  createExecutionScheduler,
  InMemoryExecutionStateStore,
} from "../runtime/execution/index.js";
import {
  ExecutionTraceReplayer,
  InMemoryExecutionTraceStore,
  replayTraceSteps,
} from "../runtime/execution/executionTrace.js";
import { ensureCapabilityExecutorsRegistered } from "../runtime/capabilityExecutors.js";
import { registerTelegramTransport } from "../transport/telegramAdapter.js";

registerTelegramTransport();
ensureCapabilityExecutorsRegistered();

describe("Execution trace debugger", () => {
  it("emits nodeStart, nodeComplete, and edgeTraversal for sequential flow", async () => {
    const traceStore = new InMemoryExecutionTraceStore();
    const plan = compileFlowGraphToExecutionIr({
      nodes: [
        { id: "a", type: "message", payload: { text: "hi" } },
        { id: "b", type: "terminal", payload: {} },
      ],
      edges: [{ from: "a", to: "b", kind: "flow" }],
    });
    const stepA = plan.steps.find((s) => s.sourceNodeId === "a");
    assert.ok(stepA?.successors?.length, `message step successors: ${JSON.stringify(stepA?.successors)}`);
    assert.equal(plan.entryStepId, stepA!.stepId);

    const store = new InMemoryExecutionStateStore();
    const scheduler = createExecutionScheduler(plan);
    const run = await scheduler.start({
      store,
      traceStore,
      maxSteps: 20,
    });

    assert.ok(run.trace);
    assert.ok(run.stepsExecuted >= 2, `expected 2+ steps, got ${run.stepsExecuted}`);
    assert.equal(run.trace.traceId, run.executionId);
    const types = run.trace.events.map((e) => e.type);
    assert.ok(types.includes("nodeStart"));
    assert.ok(types.includes("nodeComplete"));
    assert.ok(
      types.includes("edgeTraversal"),
      `expected edgeTraversal, got: ${types.join(", ")}`,
    );

    for (const ev of run.trace.events) {
      assert.equal(ev.traceId, run.trace.traceId);
      assert.equal(ev.executionId, run.executionId);
      assert.ok(ev.nodeId);
      assert.ok(ev.nodeType);
      assert.ok(typeof ev.durationMs === "number");
      assert.ok(ev.inputs);
      assert.ok(ev.outputs);
    }
  });

  it("replays trace step-by-step with ExecutionTraceReplayer", async () => {
    const traceStore = new InMemoryExecutionTraceStore();
    const plan = compileFlowGraphToExecutionIr({
      nodes: [
        { id: "m", type: "message", payload: { text: "x" } },
        { id: "t", type: "terminal", payload: {} },
      ],
      edges: [{ from: "m", to: "t", kind: "flow" }],
    });
    const run = await createExecutionScheduler(plan).start({
      store: new InMemoryExecutionStateStore(),
      traceStore,
    });
    assert.ok(run.trace);

    const replayer = ExecutionTraceReplayer.fromRecord(run.trace);
    assert.equal(replayer.length, run.trace.events.length);

    const first = replayer.current();
    assert.ok(first);
    assert.equal(first?.sequence, 0);

    const steps: string[] = [];
    while (replayer.hasNext) {
      const ev = replayer.stepForward();
      if (ev) steps.push(ev.type);
    }
    assert.ok(steps.length > 0);

    replayer.reset();
    assert.equal(replayer.currentIndex, 0);
    replayer.seek(replayer.length - 1);
    assert.equal(replayer.currentIndex, replayer.length - 1);
  });

  it("replayTraceSteps async iterator walks full trace", async () => {
    const traceStore = new InMemoryExecutionTraceStore();
    const plan = compileFlowGraphToExecutionIr({
      nodes: [
        { id: "a", type: "notify", payload: { text: "ok" } },
        { id: "b", type: "terminal", payload: {} },
      ],
      edges: [{ from: "a", to: "b", kind: "flow" }],
    });
    const run = await createExecutionScheduler(plan).start({
      store: new InMemoryExecutionStateStore(),
      traceStore,
    });
    const walked: number[] = [];
    for await (const step of replayTraceSteps(run.trace!.events)) {
      walked.push(step.index);
      assert.equal(step.event.traceId, run.trace!.traceId);
    }
    assert.equal(walked.length, run.trace!.events.length);
  });

  it("records nodeError events with structured fields", async () => {
    const { ExecutionTraceCollector } = await import(
      "../runtime/execution/executionTrace.js"
    );
    const { createExecutionContext } = await import("../runtime/executionContext.js");
    const collector = new ExecutionTraceCollector({
      traceId: "trace-err",
      executionId: "exec-err",
    });
    const ctx = createExecutionContext({ traceId: "trace-err", vars: {} });
    const step = {
      stepId: "ex_n1",
      kind: "action",
      capabilityId: "send_message",
      sourceNodeId: "n1",
      payload: {},
    };
    await collector.nodeError(
      step,
      ctx,
      new Error("simulated failure"),
      { stepId: "ex_n1", vars: {} },
      12.5,
    );
    const errEv = collector.events.find((e) => e.type === "nodeError");
    assert.ok(errEv);
    assert.equal(errEv?.traceId, "trace-err");
    assert.equal(errEv?.nodeId, "n1");
    assert.equal(errEv?.durationMs, 12.5);
    assert.match(String(errEv?.outputs.error), /simulated/);
  });
});
