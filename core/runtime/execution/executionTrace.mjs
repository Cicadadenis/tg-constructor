/**
 * Execution Debugger — structured trace events for graph runtime.
 */

import { performance } from 'node:perf_hooks';
import { stepNodeId, stepNodeType } from './executionErrors.mjs';

export const EXECUTION_TRACE_VERSION = '1.0';

/** @typedef {'nodeStart' | 'nodeComplete' | 'nodeError' | 'edgeTraversal'} ExecutionTraceEventType */

/**
 * @typedef {object} ExecutionTraceEvent
 * @property {string} traceEventVersion
 * @property {number} sequence
 * @property {string} traceId
 * @property {string} executionId
 * @property {ExecutionTraceEventType} type
 * @property {string} nodeId
 * @property {string} nodeType
 * @property {Readonly<Record<string, unknown>>} inputs
 * @property {Readonly<Record<string, unknown>>} outputs
 * @property {number} durationMs
 * @property {string} timestamp
 */

/**
 * @param {Record<string, unknown>} obj
 */
function freezeRecord(obj) {
  return Object.freeze({ ...obj });
}

/**
 * @param {object} step
 * @param {import('../executionContext.js').ExecutionContext} execution
 */
export function buildTraceInputs(step, execution) {
  return freezeRecord({
    stepId: step.stepId,
    capabilityId: step.capabilityId ?? null,
    payload: step.payload ? { ...step.payload } : {},
    vars: { ...execution.vars },
    executionPath: execution.temp?.__executionPath ?? null,
  });
}

/**
 * @param {object} outcome
 * @param {import('../executionContext.js').ExecutionContext} execution
 * @param {object} [extra]
 */
export function buildTraceOutputs(outcome, execution, extra = {}) {
  const lastEffects = execution.temp?.__lastTraceEffects;
  const outputs = {
    status: outcome.status ?? 'running',
    nextStepIds: outcome.nextStepIds ? [...outcome.nextStepIds] : [],
    halted: Boolean(outcome.halted),
    vars: { ...execution.vars },
    ...extra,
  };
  if (lastEffects) {
    outputs.effects = Array.isArray(lastEffects) ? [...lastEffects] : lastEffects;
    delete execution.temp.__lastTraceEffects;
  }
  return freezeRecord(outputs);
}

/**
 * @param {Omit<ExecutionTraceEvent, 'traceEventVersion' | 'sequence' | 'timestamp'> & { sequence?: number, timestamp?: string }} partial
 * @returns {ExecutionTraceEvent}
 */
export function freezeTraceEvent(partial) {
  return Object.freeze({
    traceEventVersion: EXECUTION_TRACE_VERSION,
    sequence: partial.sequence ?? 0,
    traceId: partial.traceId,
    executionId: partial.executionId,
    type: partial.type,
    nodeId: partial.nodeId,
    nodeType: partial.nodeType,
    inputs: freezeRecord(partial.inputs || {}),
    outputs: freezeRecord(partial.outputs || {}),
    durationMs: partial.durationMs ?? 0,
    timestamp: partial.timestamp ?? new Date().toISOString(),
  });
}

/**
 * @typedef {object} ExecutionTraceRecord
 * @property {string} traceId
 * @property {string} executionId
 * @property {readonly ExecutionTraceEvent[]} events
 */

export class InMemoryExecutionTraceStore {
  constructor() {
    /** @type {Map<string, ExecutionTraceEvent[]>} */
    this._byExecution = new Map();
  }

  /**
   * @param {ExecutionTraceEvent} event
   */
  async append(event) {
    const key = event.executionId;
    if (!this._byExecution.has(key)) {
      this._byExecution.set(key, []);
    }
    this._byExecution.get(key).push(event);
  }

  /**
   * @param {string} executionId
   * @returns {readonly ExecutionTraceEvent[]}
   */
  async list(executionId) {
    return Object.freeze([...(this._byExecution.get(executionId) || [])]);
  }

  /**
   * @param {string} executionId
   * @returns {ExecutionTraceRecord | null}
   */
  async getRecord(executionId) {
    const events = this._byExecution.get(executionId);
    if (!events?.length) return null;
    return {
      traceId: events[0].traceId,
      executionId,
      events: Object.freeze([...events]),
    };
  }

  clear() {
    this._byExecution.clear();
  }
}

let defaultTraceStore = null;

export function getDefaultExecutionTraceStore() {
  if (!defaultTraceStore) {
    defaultTraceStore = new InMemoryExecutionTraceStore();
  }
  return defaultTraceStore;
}

/**
 * Collects trace events during scheduler runs.
 */
export class ExecutionTraceCollector {
  /**
   * @param {{ traceId: string, executionId: string, store?: InMemoryExecutionTraceStore, onEvent?: (event: ExecutionTraceEvent) => void }} options
   */
  constructor(options) {
    this.traceId = options.traceId;
    this.executionId = options.executionId;
    this.store = options.store ?? getDefaultExecutionTraceStore();
    this.onEvent = options.onEvent ?? null;
    this._sequence = 0;
    /** @type {ExecutionTraceEvent[]} */
    this._events = [];
  }

  get events() {
    return Object.freeze([...this._events]);
  }

  /**
   * @param {Omit<ExecutionTraceEvent, 'traceEventVersion' | 'sequence' | 'timestamp' | 'traceId' | 'executionId'>} partial
   */
  async emit(partial) {
    const event = freezeTraceEvent({
      ...partial,
      sequence: this._sequence,
      traceId: this.traceId,
      executionId: this.executionId,
    });
    this._sequence += 1;
    this._events.push(event);
    await this.store.append(event);
    if (this.onEvent) {
      this.onEvent(event);
    }
    return event;
  }

  /**
   * @param {object} step
   * @param {import('../executionContext.js').ExecutionContext} execution
   */
  async nodeStart(step, execution) {
    return this.emit({
      type: 'nodeStart',
      nodeId: stepNodeId(step),
      nodeType: stepNodeType(step),
      inputs: buildTraceInputs(step, execution),
      outputs: freezeRecord({}),
      durationMs: 0,
    });
  }

  /**
   * @param {object} step
   * @param {import('../executionContext.js').ExecutionContext} execution
   * @param {Record<string, unknown>} outputs
   * @param {number} durationMs
   */
  async nodeComplete(step, execution, outputs, durationMs) {
    return this.emit({
      type: 'nodeComplete',
      nodeId: stepNodeId(step),
      nodeType: stepNodeType(step),
      inputs: buildTraceInputs(step, execution),
      outputs: freezeRecord(outputs),
      durationMs,
    });
  }

  /**
   * @param {object} step
   * @param {import('../executionContext.js').ExecutionContext} execution
   * @param {unknown} error
   * @param {Readonly<Record<string, unknown>>} inputs
   * @param {number} durationMs
   */
  async nodeError(step, execution, error, inputs, durationMs) {
    const message = error instanceof Error ? error.message : String(error);
    return this.emit({
      type: 'nodeError',
      nodeId: stepNodeId(step),
      nodeType: stepNodeType(step),
      inputs: freezeRecord(inputs),
      outputs: freezeRecord({
        error: message,
        name: error instanceof Error ? error.name : 'Error',
        vars: { ...execution.vars },
      }),
      durationMs,
    });
  }

  /**
   * @param {object} fromStep
   * @param {object} toStep
   * @param {import('../executionContext.js').ExecutionContext} execution
   * @param {{ edgeKind?: string, branchId?: string }} [meta]
   */
  async edgeTraversal(fromStep, toStep, execution, meta = {}) {
    return this.emit({
      type: 'edgeTraversal',
      nodeId: stepNodeId(fromStep),
      nodeType: stepNodeType(fromStep),
      inputs: buildTraceInputs(fromStep, execution),
      outputs: freezeRecord({
        toNodeId: stepNodeId(toStep),
        toNodeType: stepNodeType(toStep),
        toStepId: toStep.stepId,
        ...meta,
      }),
      durationMs: 0,
    });
  }
}

/**
 * @param {object} step
 * @param {import('../executionContext.js').ExecutionContext} execution
 * @param {(step: object, execution: import('../executionContext.js').ExecutionContext) => Promise<*>} fn
 * @param {ExecutionTraceCollector | null | undefined} trace
 */
export async function withNodeTrace(step, execution, fn, trace) {
  if (!trace) {
    return fn();
  }
  const inputs = buildTraceInputs(step, execution);
  const t0 = performance.now();
  await trace.nodeStart(step, execution);
  try {
    const result = await fn();
    const outputs =
      result && typeof result === 'object' && 'traceOutputs' in result
        ? /** @type {{ traceOutputs: Record<string, unknown> }} */ (result).traceOutputs
        : freezeRecord({ result: result ?? null });
    await trace.nodeComplete(step, execution, outputs, performance.now() - t0);
    return result;
  } catch (err) {
    await trace.nodeError(step, execution, err, inputs, performance.now() - t0);
    throw err;
  }
}
