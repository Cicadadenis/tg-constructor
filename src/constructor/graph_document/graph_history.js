/**
 * Append-only operation log with deterministic replay (no snapshot history).
 */

import { createGraphDocument } from './graph_document.js';
import { applyOperationWithRestores, createOperation } from './graph_operations.js';
import { runGraphValidationPipeline } from './graph_validation_pipeline.js';

export function createGraphHistory(seedDocument = {}) {
  return {
    document: createGraphDocument(seedDocument),
    stream: [],
    cursor: 0,
  };
}

function operationBaseRevision(operation) {
  const op = operation?.operation ?? operation;
  if (op?.baseRevision != null) return Number(op.baseRevision);
  if (op?.payload?.baseRevision != null) return Number(op.payload.baseRevision);
  return null;
}

export function applyOperation(history, operation) {
  const op = operation?.type ? operation : createOperation(operation?.type, operation?.payload, operation);
  const docRevision = Number(history.document?.metadata?.revision ?? 0);
  const expected = operationBaseRevision(op);
  if (expected != null && !Number.isNaN(expected) && expected !== docRevision) {
    return {
      ...history,
      lastError: `Revision conflict: operation expects base ${expected}, document at ${docRevision}`,
      lastResult: null,
    };
  }
  const active = history.stream.slice(0, history.cursor);
  const result = applyOperationWithRestores(history.document, op);
  if (!result.ok) {
    return { ...history, lastError: result.error, lastResult: result };
  }
  const entry = Object.freeze({
    operation: op,
    inverse: result.inverse,
    revision: result.document.metadata.revision,
  });
  const stream = [...active, entry];
  return {
    document: result.document,
    stream,
    cursor: stream.length,
    lastResult: result,
    lastError: null,
  };
}

export function rollbackOperation(history) {
  const cursor = Number(history?.cursor ?? 0);
  if (cursor <= 0) {
    return { ...history, cursor, lastError: 'Nothing to rollback' };
  }
  const entry = history.stream[cursor - 1];
  const result = applyOperationWithRestores(history.document, entry.inverse);
  if (!result.ok) {
    return { ...history, lastError: result.error, lastResult: result };
  }
  return {
    document: result.document,
    stream: history.stream,
    cursor: cursor - 1,
    lastResult: result,
    lastError: null,
  };
}

export function redoOperation(history) {
  if (history.cursor >= history.stream.length) {
    return { ...history, lastError: 'Nothing to redo' };
  }
  const entry = history.stream[history.cursor];
  const result = applyOperationWithRestores(history.document, entry.operation);
  if (!result.ok) {
    return { ...history, lastError: result.error, lastResult: result };
  }
  return {
    document: result.document,
    stream: history.stream,
    cursor: history.cursor + 1,
    lastResult: result,
    lastError: null,
  };
}

/**
 * Deterministic replay from an operation stream (collaboration / sync).
 * @param {object} seedDocument
 * @param {object[]} operations — serializable operations in order
 * @param {{ through?: number }} options
 */
export function replayOperations(seedDocument, operations = [], options = {}) {
  let document = createGraphDocument(seedDocument);
  const applied = [];
  const limit = options.through ?? operations.length;
  for (let i = 0; i < limit && i < operations.length; i += 1) {
    const op = operations[i];
    const result = applyOperationWithRestores(document, op);
    if (!result.ok) {
      return {
        ok: false,
        document,
        applied,
        failedAt: i,
        error: result.error,
      };
    }
    document = result.document;
    applied.push(op);
  }
  return { ok: true, document, applied };
}

/**
 * Merge remote operations after a common prefix.
 * Rejects remote ops whose baseRevision disagrees with localRevision (when both set).
 */
export function mergeOperationStreams(localOps = [], remoteOps = [], options = {}) {
  const key = options.idKey || 'id';
  const localRevision = options.localRevision != null ? Number(options.localRevision) : null;
  const strict = Boolean(options.strict);
  const seen = new Set(localOps.map((o) => o[key]));
  const merged = [...localOps];
  const rejected = [];

  for (const op of remoteOps) {
    if (seen.has(op[key])) continue;
    const expected = operationBaseRevision(op);
    if (
      localRevision != null
      && expected != null
      && !Number.isNaN(expected)
      && expected !== localRevision
    ) {
      rejected.push({ op, reason: 'baseRevision_mismatch', expected, localRevision });
      if (strict) continue;
    }
    merged.push(op);
    seen.add(op[key]);
  }

  merged.sort((a, b) => {
    const ta = a.timestamp ?? 0;
    const tb = b.timestamp ?? 0;
    if (ta !== tb) return ta - tb;
    return String(a[key] ?? '').localeCompare(String(b[key] ?? ''));
  });

  if (options.includeRejected) {
    return { merged, rejected };
  }
  return merged;
}

/**
 * Replay merged operations and validate resulting document integrity.
 */
export function mergeAndValidateOperationStreams(
  seedDocument,
  localOps = [],
  remoteOps = [],
  options = {},
) {
  const { merged, rejected } = mergeOperationStreams(localOps, remoteOps, {
    ...options,
    includeRejected: true,
  });
  const replay = replayOperations(seedDocument, merged, options);
  if (!replay.ok) {
    return {
      ok: false,
      merged,
      rejected,
      replay,
      validation: null,
    };
  }
  const strict = Boolean(options.strict);
  const validation = runGraphValidationPipeline(replay.document, {
    strict,
    allowMissingCallbackHandlers: options.allowMissingCallbackHandlers ?? !strict,
  });
  return {
    ok: replay.ok && validation.ok,
    merged,
    rejected,
    replay,
    validation,
  };
}

export function exportOperationStream(history) {
  return history.stream.slice(0, history.cursor).map((e) => ({
    ...e.operation,
    revision: e.revision,
  }));
}
