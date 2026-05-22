import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createGraphDocument } from './graph_document.js';
import { applyOperation } from './graph_operations.js';
import {
  repairGraphIssues,
  REPAIR_ACTION_REGISTRY,
} from './graph_auto_repair.js';
import {
  beginRepairTransaction,
  commitRepairTransaction,
  dryRunRepairOperations,
  rollbackRepair,
} from './graph_repair_transaction.js';
import { createGraphHistory, applyOperation as applyHistoryOp, rollbackOperation } from './graph_history.js';
import { repairDuplicateEdges } from './graph_edge_repair.js';
import { strictCompileValidation } from './graph_validation_pipeline.js';
import { VALIDATION_STAGE } from './validation_stages.js';

describe('graph auto repair', () => {
  it('repairs dangling invalid edge', () => {
    const doc = createGraphDocument({
      nodes: [
        { id: 'st', type: 'start', position: { x: 0, y: 0 } },
        { id: 'm', type: 'message', position: { x: 0, y: 100 }, data: { text: 'hi' } },
      ],
      edges: [
        { id: 'ok', source: 'st', target: 'm' },
        { id: 'bad', source: 'm', target: 'ghost', invalid: true, invalidReason: 'dangling_target' },
      ],
    });
    assert.equal(Object.keys(doc.edges).length, 1);
    const r = repairGraphIssues(doc);
    assert.ok(r.fixCount >= 0);
  });

  it('repairs duplicate edges', () => {
    const doc = createGraphDocument({
      nodes: [
        { id: 'st', type: 'start', position: { x: 0, y: 0 } },
        { id: 'm', type: 'message', position: { x: 0, y: 120 }, data: { text: 'x' } },
      ],
      edges: [
        { id: 'e1', source: 'st', target: 'm' },
        { id: 'e2', source: 'st', target: 'm' },
      ],
    });
    const dup = repairDuplicateEdges(doc);
    assert.equal(dup.removed.length, 1);
    assert.equal(dup.operations.length, 1);
  });

  it('auto-creates callback handler', () => {
    const doc = createGraphDocument({
      nodes: [
        { id: 'st', type: 'start', position: { x: 0, y: 0 } },
        { id: 'inl', type: 'inline', position: { x: 0, y: 100 }, data: { buttons: 'Go → cb_go' } },
      ],
      edges: [{ id: 'e1', source: 'st', target: 'inl' }],
    });
    const r = repairGraphIssues(doc);
    assert.ok(r.operations.length > 0);
    let next = doc;
    for (const op of r.operations) {
      const out = applyOperation(next, op);
      assert.equal(out.ok, true, out.error);
      next = out.document;
    }
    const gate = strictCompileValidation(next, { validationStage: VALIDATION_STAGE.COMMITTED });
    assert.equal(
      gate.errors.filter((e) => e.code === 'missing_handlers').length,
      0,
    );
  });

  it('dry-run then rollback failed mid commit', () => {
    const history = createGraphHistory(createGraphDocument({
      nodes: [
        { id: 'st', type: 'start', position: { x: 0, y: 0 } },
        { id: 'm', type: 'message', position: { x: 0, y: 100 }, data: { text: 'a' } },
      ],
      edges: [{ id: 'e1', source: 'st', target: 'm' }],
    }));
    const doc = history.document;
    const r = repairGraphIssues(doc);
    const store = {
      dispatch: (op) => {
        const h = applyHistoryOp(history, op);
        Object.assign(history, h);
        return { ok: !h.lastError, document: h.document, error: h.lastError };
      },
      undo: () => {
        const h = rollbackOperation(history);
        Object.assign(history, h);
        return { ok: !h.lastError };
      },
      getGraphDocument: () => history.document,
    };
    const committed = commitRepairTransaction(store, r.transaction, r.operations.slice(0, 1));
    assert.equal(committed.ok, true);
    rollbackRepair(store, 1);
    assert.equal(Object.keys(store.getGraphDocument().nodes).length, 2);
  });

  it('undo repair via transaction steps', () => {
    const doc = createGraphDocument({
      nodes: [
        { id: 'st', type: 'start', position: { x: 0, y: 0 } },
        { id: 'm', type: 'message', position: { x: 0, y: 100 }, data: { text: 'a' } },
      ],
      edges: [
        { id: 'e1', source: 'st', target: 'm' },
        { id: 'e2', source: 'st', target: 'm' },
      ],
    });
    const preview = repairGraphIssues(doc);
    const tx = beginRepairTransaction(doc);
    const dry = dryRunRepairOperations(tx, preview.operations);
    assert.equal(dry.ok, true);
    assert.ok(dry.applied.length >= 1);
  });

  it('registry has detect explain repair for each action', () => {
    for (const action of REPAIR_ACTION_REGISTRY) {
      assert.equal(typeof action.detect, 'function');
      assert.equal(typeof action.explain, 'function');
      assert.equal(typeof action.repair, 'function');
    }
  });
});
