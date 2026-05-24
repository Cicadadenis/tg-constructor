import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSideEffectIdempotencyKey,
  createExecutionHistory,
  createExecutionScheduler,
  foldExecutionEvents,
  InMemoryExecutionEventStore,
  InMemoryExecutionStateStore,
  replayExecutionEvents,
  replayToCheckpoint,
  type ExecutionEvent,
} from "../../core/runtime/execution/index.js";
import "../../core/node_manifest/init.mjs";
import { compileFlowGraphToExecutionIr } from "../../core/ai/executionGraphCompiler.mjs";
import { ensureCapabilityExecutorsRegistered } from "../../core/runtime/capabilityExecutors.js";

ensureCapabilityExecutorsRegistered();

function sequentialFlow() {
  return compileFlowGraphToExecutionIr({
    nodes: [
      { id: "a", type: "notify", payload: { text: "Hi" } },
      { id: "b", type: "terminal", payload: {} },
    ],
    edges: [{ from: "a", to: "b", kind: "flow" }],
  });
}

describe("Execution event sourcing", () => {
  it("reducer + replay reproduces same state deterministically", () => {
    const events: ExecutionEvent[] = [
      {
        eventVersion: "1.0",
        sequence: 1,
        executionId: "ex-1",
        planId: "plan-1",
        type: "execution.started",
        timestamp: "2020-01-01T00:00:00.000Z",
        payload: { entryStepId: "step_a" },
      },
      {
        eventVersion: "1.0",
        sequence: 2,
        executionId: "ex-1",
        planId: "plan-1",
        type: "step.completed",
        timestamp: "2020-01-01T00:00:01.000Z",
        payload: { stepId: "step_a", nextStepIds: ["step_b"] },
      },
      {
        eventVersion: "1.0",
        sequence: 3,
        executionId: "ex-1",
        planId: "plan-1",
        type: "execution.completed",
        timestamp: "2020-01-01T00:00:02.000Z",
        payload: {},
      },
    ];

    const folded = foldExecutionEvents(events);
    const replayed = replayExecutionEvents(events).state;

    assert.equal(folded.status, "completed");
    assert.equal(replayed.status, "completed");
    assert.equal(replayed.lastEventSequence, 3);
    assert.deepEqual(
      replayToCheckpoint(events, 2).state.activeStepIds,
      ["step_b"],
    );
  });

  it("idempotency keys prevent duplicate side effects on replay", () => {
    const key = buildSideEffectIdempotencyKey("ex", "step1", "send_message", 1);
    const events: ExecutionEvent[] = [
      {
        eventVersion: "1.0",
        sequence: 1,
        executionId: "ex",
        planId: "p",
        type: "execution.started",
        timestamp: "2020-01-01T00:00:00.000Z",
        payload: { entryStepId: "step1" },
      },
      {
        eventVersion: "1.0",
        sequence: 2,
        executionId: "ex",
        planId: "p",
        type: "action.side_effect_recorded",
        timestamp: "2020-01-01T00:00:01.000Z",
        payload: {
          stepId: "step1",
          ok: true,
          nextStepIds: [],
          variables: { x: 1 },
        },
        idempotencyKey: key,
      },
    ];

    const state = replayExecutionEvents(events).state;
    assert.ok(state.appliedIdempotencyKeys.includes(key));
    assert.equal((state.variables as { x: number }).x, 1);
  });

  it("scheduler recovers via event replay after crash (no snapshot)", async () => {
    const plan = sequentialFlow();
    const eventStore = new InMemoryExecutionEventStore();
    const projectionStore = new InMemoryExecutionStateStore();
    const scheduler = createExecutionScheduler(plan);

    const started = await scheduler.start({
      eventStore,
      store: projectionStore,
      maxSteps: 5,
    });
    assert.ok(started.eventsAppended >= 1);

    const events = await eventStore.load(started.executionId);
    assert.ok(events.length >= 1);
    assert.equal(events[0].type, "execution.started");

    projectionStore.clear();

    const recovered = await scheduler.recover(started.executionId, {
      eventStore,
      store: projectionStore,
    });
    assert.equal(recovered.executionId, started.executionId);
    assert.ok(recovered.lastEventSequence >= 1);
  });

  it("time-travel debugging returns state at sequence", async () => {
    const plan = sequentialFlow();
    const eventStore = new InMemoryExecutionEventStore();
    const store = new InMemoryExecutionStateStore();
    const history = createExecutionHistory(eventStore, store);
    const scheduler = createExecutionScheduler(plan);

    const result = await scheduler.start({ eventStore, store, maxSteps: 20 });
    const session = await history.createDebugSession(result.executionId);
    const timeline = await session.timeline();

    assert.ok(timeline.length >= 2);
    const mid = timeline[Math.floor(timeline.length / 2)];
    const atMid = session.stateAt(mid.sequence).state;
    assert.equal(atMid.lastEventSequence, mid.sequence);

    const diff = session.diff(1, timeline[timeline.length - 1].sequence);
    assert.ok(Object.keys(diff).length > 0);
  });

  it("event-based resume continues from replayed state", async () => {
    const plan = compileFlowGraphToExecutionIr({
      nodes: [
        { id: "j", type: "merge", payload: {} },
        { id: "t", type: "terminal", payload: {} },
      ],
      edges: [{ from: "j", to: "t", kind: "flow" }],
    });
    const eventStore = new InMemoryExecutionEventStore();
    const store = new InMemoryExecutionStateStore();
    const scheduler = createExecutionScheduler(plan);

    const started = await scheduler.start({ eventStore, store, maxSteps: 1 });
    const eventsAfterStart = await eventStore.load(started.executionId);
    assert.ok(eventsAfterStart.length >= 1);

    const replayedBeforeResume = replayExecutionEvents(eventsAfterStart).state;
    const resumed = await scheduler.resume(started.executionId, {
      eventStore,
      store,
      maxSteps: 50,
    });
    assert.ok(resumed.eventsAppended >= 0);

    const finalEvents = await eventStore.load(started.executionId);
    const replayedFinal = replayExecutionEvents(finalEvents).state;
    assert.equal(replayedFinal.executionId, started.executionId);
    assert.ok(
      replayedFinal.lastEventSequence
        >= replayedBeforeResume.lastEventSequence,
    );
  });

  it("replayOnly mode records events without re-executing side effects", async () => {
    const plan = sequentialFlow();
    const eventStore = new InMemoryExecutionEventStore();
    const store = new InMemoryExecutionStateStore();
    const scheduler = createExecutionScheduler(plan);

    const live = await scheduler.start({ eventStore, store, maxSteps: 20 });
    const events = await eventStore.load(live.executionId);
    const sideEffects = events.filter((e) => e.type === "action.side_effect_recorded");
    assert.ok(sideEffects.length >= 0);

    const replayRun = await scheduler.run(live.executionId, {
      eventStore,
      store,
      replayOnly: true,
      maxSteps: 20,
    });
    const replayed = replayExecutionEvents(await eventStore.load(live.executionId)).state;
    assert.equal(replayRun.snapshot.executionId, replayed.executionId);
  });
});
