/**
 * Atomic repair transactions — snapshot, apply, rollback, undo steps.
 */

import { createGraphDocument, cloneGraphDocument } from './graph_document.js';
import { applyOperation } from './graph_operations.js';

function uid(prefix = 'repair') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * @param {object} document
 * @returns {import('./graph_repair_transaction.js').RepairTransaction}
 */
export function beginRepairTransaction(document) {
  const doc = createGraphDocument(document);
  return {
    id: uid(),
    snapshot: cloneGraphDocument(doc),
    baseRevision: Number(doc.metadata?.revision ?? 0),
    startedAt: Date.now(),
    applied: [],
  };
}

/**
 * Dry-run repair operations on snapshot (no store mutation).
 * @param {import('./graph_repair_transaction.js').RepairTransaction} tx
 * @param {object[]} operations
 */
export function dryRunRepairOperations(tx, operations = []) {
  let doc = createGraphDocument(tx.snapshot);
  const applied = [];
  for (const op of operations) {
    const result = applyOperation(doc, op);
    if (!result.ok) {
      return {
        ok: false,
        document: tx.snapshot,
        applied,
        error: result.error,
      };
    }
    doc = result.document;
    applied.push(op);
  }
  return { ok: true, document: doc, applied };
}

/**
 * Apply repair ops to live editor (dispatch). Rolls back on failure.
 * @param {{ dispatch: Function, undo: Function }} store
 * @param {import('./graph_repair_transaction.js').RepairTransaction} tx
 * @param {object[]} operations
 */
export function commitRepairTransaction(store, tx, operations = []) {
  const dry = dryRunRepairOperations(tx, operations);
  if (!dry.ok) {
    return { ok: false, error: dry.error, applied: [], undoSteps: 0 };
  }

  const applied = [];
  for (const op of operations) {
    const result = store.dispatch(op);
    if (!result?.ok) {
      rollbackRepair(store, applied.length);
      return {
        ok: false,
        error: result?.error || 'Repair dispatch failed',
        applied,
        undoSteps: 0,
      };
    }
    applied.push(op);
  }

  tx.applied = applied;
  return {
    ok: true,
    applied,
    undoSteps: applied.length,
    document: store.getGraphDocument?.() || dry.document,
  };
}

/**
 * Undo N repair operations (one undo per graph op).
 * @param {{ undo: Function }} store
 * @param {number} steps
 */
export function rollbackRepair(store, steps = 0) {
  const n = Math.max(0, Number(steps) || 0);
  for (let i = 0; i < n; i += 1) {
    const r = store.undo();
    if (!r?.ok) break;
  }
  return { rolledBack: n };
}
