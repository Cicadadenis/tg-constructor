/**
 * Journal helper — append events and apply incremental reducer.
 */

import type { ExecutionEvent, ExecutionEventInput } from "./executionEvents.js";
import type { ExecutionEventStore } from "./executionEventStore.js";
import { buildEventInput } from "./executionEventStore.js";
import { reduceExecutionState } from "./executionStateReducer.js";
import { replayExecutionEvents } from "./executionReplayEngine.js";
import type { ExecutionStateSnapshot } from "./executionState.js";
import type { ExecutionEventType } from "./executionEvents.js";

export class ExecutionEventJournal {
  private state: ExecutionStateSnapshot | null = null;

  constructor(
    readonly executionId: string,
    readonly planId: string,
    private readonly eventStore: ExecutionEventStore,
  ) {}

  get currentState(): ExecutionStateSnapshot | null {
    return this.state;
  }

  async recoverFromEvents(): Promise<ExecutionStateSnapshot> {
    const events = await this.eventStore.load(this.executionId);
    if (!events.length) {
      if (!this.state) {
        throw new Error(`No events for execution ${this.executionId}`);
      }
      return this.state;
    }
    const { state } = replayExecutionEvents(events);
    this.state = state;
    return state;
  }

  async append(
    type: ExecutionEventType,
    payload: Record<string, unknown>,
    extras: { idempotencyKey?: string } = {},
  ): Promise<{ event: ExecutionEvent; state: ExecutionStateSnapshot }> {
    const input: ExecutionEventInput = buildEventInput(
      this.executionId,
      this.planId,
      type,
      payload,
      extras,
    );
    const event = await this.eventStore.append(this.executionId, input);
    this.state = reduceExecutionState(this.state, event);
    return { event, state: this.state };
  }

  async appendStarted(entryStepId: string): Promise<ExecutionStateSnapshot> {
    const { state } = await this.append("execution.started", { entryStepId });
    return state;
  }

  async appendResumed(activeStepIds: string[]): Promise<ExecutionStateSnapshot> {
    const { state } = await this.append("execution.resumed", { activeStepIds });
    return state;
  }
}
