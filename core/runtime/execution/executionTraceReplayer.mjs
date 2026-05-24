/**
 * Step-by-step replay navigator over an execution trace.
 */

/**
 * @typedef {import('./executionTrace.mjs').ExecutionTraceEvent} ExecutionTraceEvent
 */

export class ExecutionTraceReplayer {
  /**
   * @param {readonly ExecutionTraceEvent[]} events
   */
  constructor(events) {
    this._events = Object.freeze([...(events || [])]);
    this._index = this._events.length ? 0 : -1;
  }

  /** @param {readonly ExecutionTraceEvent[]} events */
  static fromEvents(events) {
    return new ExecutionTraceReplayer(events);
  }

  /** @param {import('./executionTrace.mjs').ExecutionTraceRecord} record */
  static fromRecord(record) {
    return new ExecutionTraceReplayer(record.events);
  }

  get length() {
    return this._events.length;
  }

  get currentIndex() {
    return this._index;
  }

  get hasNext() {
    return this._index < this._events.length - 1;
  }

  get hasPrevious() {
    return this._index > 0;
  }

  /**
   * @returns {ExecutionTraceEvent | null}
   */
  current() {
    if (this._index < 0 || this._index >= this._events.length) return null;
    return this._events[this._index];
  }

  /**
   * @returns {ExecutionTraceEvent | null}
   */
  stepForward() {
    if (!this.hasNext) return null;
    this._index += 1;
    return this.current();
  }

  /**
   * @returns {ExecutionTraceEvent | null}
   */
  stepBack() {
    if (!this.hasPrevious) return null;
    this._index -= 1;
    return this.current();
  }

  reset() {
    this._index = this._events.length ? 0 : -1;
    return this.current();
  }

  /**
   * Jump to trace sequence (0-based index into events array).
   * @param {number} index
   * @returns {ExecutionTraceEvent | null}
   */
  seek(index) {
    if (!this._events.length) {
      this._index = -1;
      return null;
    }
    const i = Math.max(0, Math.min(index, this._events.length - 1));
    this._index = i;
    return this.current();
  }

  /**
   * All events up to and including current index.
   * @returns {readonly ExecutionTraceEvent[]}
   */
  snapshotThroughCurrent() {
    if (this._index < 0) return Object.freeze([]);
    return Object.freeze(this._events.slice(0, this._index + 1));
  }

  /**
   * Reconstruct vars after applying setState from nodeComplete outputs up to index.
   * @param {number} [index]
   * @returns {Record<string, unknown>}
   */
  getVarsAt(index = this._index) {
    const vars = {};
    const limit = index < 0 ? -1 : Math.min(index, this._events.length - 1);
    for (let i = 0; i <= limit; i += 1) {
      const ev = this._events[i];
      if (ev.type === 'nodeComplete' || ev.type === 'nodeStart') {
        const v = ev.outputs?.vars ?? ev.inputs?.vars;
        if (v && typeof v === 'object') {
          Object.assign(vars, v);
        }
      }
      if (ev.type === 'nodeComplete' && ev.outputs?.effects) {
        const effects = ev.outputs.effects;
        if (Array.isArray(effects)) {
          for (const effect of effects) {
            if (effect?.type === 'setState' && effect.vars) {
              Object.assign(vars, effect.vars);
            }
          }
        }
      }
    }
    return Object.freeze({ ...vars });
  }

  /**
   * @returns {{ traceId: string | null, executionId: string | null, events: readonly ExecutionTraceEvent[] }}
   */
  getMetadata() {
    const first = this._events[0];
    return {
      traceId: first?.traceId ?? null,
      executionId: first?.executionId ?? null,
      events: this._events,
    };
  }
}

/**
 * Async iterator for step-by-step replay (for debugger UIs / tests).
 * @param {readonly ExecutionTraceEvent[]} events
 */
export async function* replayTraceSteps(events) {
  const replayer = new ExecutionTraceReplayer(events);
  const first = replayer.reset();
  if (first) {
    yield { index: 0, event: first, vars: replayer.getVarsAt(0) };
  }
  while (replayer.hasNext) {
    const event = replayer.stepForward();
    if (!event) break;
    yield {
      index: replayer.currentIndex,
      event,
      vars: replayer.getVarsAt(replayer.currentIndex),
    };
  }
}
