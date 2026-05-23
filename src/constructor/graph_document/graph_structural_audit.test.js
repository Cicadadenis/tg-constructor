import assert from 'node:assert/strict';
import { createGraphDocument } from './graph_document.js';
import { createOperation, applyOperation } from './graph_operations.js';
import {
  createGraphHistory,
  applyOperation as applyHistoryOperation,
  rollbackOperation,
  redoOperation,
} from './graph_history.js';
import { canConnect, validateConnection } from './operation_registry.js';
import { compileAddBlockToStack } from './graph_ui_compositions.js';
import {
  runGraphStructuralAudit,
  validateGraphConnections,
  detectOrphanNodes,
  detectUnreachableChains,
  detectBrokenCallbacks,
  validateConnectionRequest,
} from './graph_structural_audit.js';
import { validateGraph } from './validate_graph.js';

function doc(overrides = {}) {
  return createGraphDocument({
    nodes: overrides.nodes || [],
    edges: overrides.edges || [],
    ...overrides,
  });
}

// --- broken edge (dangling target) — pre-hydration + validateGraph ---
{
  const seed = {
    nodes: [
      { id: 'a', type: 'start', position: { x: 0, y: 0 } },
      { id: 'b', type: 'message', position: { x: 0, y: 100 }, data: { text: 'hi' } },
    ],
    edges: [{ id: 'e1', source: 'b', target: 'ghost' }],
  };
  const audit = runGraphStructuralAudit(seed);
  assert.ok(audit.errors.some((x) => x.code === 'dangling_edge'));
  const full = validateGraph(seed);
  assert.equal(full.ok, false);
}

// --- undo/redo edge restore ---
{
  const history = createGraphHistory(doc({
    nodes: [
      { id: 's', type: 'start', position: { x: 0, y: 0 } },
      { id: 'm', type: 'message', position: { x: 0, y: 100 }, data: { text: 'x' } },
    ],
    edges: [],
  }));
  const h1 = applyHistoryOperation(history, createOperation('AddEdge', {
    edgeId: 'e1', source: 's', target: 'm',
  }));
  assert.equal(Object.keys(h1.document.edges).length, 1);
  const rolled = rollbackOperation(h1);
  assert.equal(Object.keys(rolled.document.edges).length, 0);
  const redone = redoOperation(rolled);
  assert.equal(Object.keys(redone.document.edges).length, 1);
  const audit = runGraphStructuralAudit(redone.document);
  assert.equal(audit.ok, true, JSON.stringify(audit.errors));
}

// --- orphan callback (inline without handler) ---
{
  const d = doc({
    nodes: [
      { id: 'st', type: 'start', position: { x: 0, y: 0 } },
      { id: 'inl', type: 'inline', position: { x: 0, y: 100 }, data: { buttons: 'Кнопка → orphan_cb' } },
    ],
    edges: [{ id: 'e1', source: 'st', target: 'inl' }],
  });
  const broken = detectBrokenCallbacks(d);
  assert.ok(broken.length > 0, 'expected missing callback handler');
  const soft = validateGraph(d, { allowMissingCallbackHandlers: true });
  assert.equal(soft.ok, true);
  assert.ok((soft.diagnostics || []).some((i) => i.code === 'missing_handlers' && i.severity === 'warning'));

  const full = validateGraph(d, { strict: true });
  assert.equal(full.ok, false);
  assert.ok(full.issues.some((i) => i.code === 'missing_handlers'));
}

// --- invalid branch (condition without FALSE) ---
{
  const d = doc({
    nodes: [
      { id: 'st', type: 'start', position: { x: 0, y: 0 } },
      { id: 'c', type: 'condition', position: { x: 0, y: 100 }, data: { cond: 'x > 0' } },
      { id: 't', type: 'message', position: { x: -100, y: 200 }, data: { text: 'yes' } },
    ],
    edges: [
      { id: 'e1', source: 'st', target: 'c' },
      { id: 'e2', source: 'c', target: 't', sourcePort: 'true' },
    ],
  });
  const audit = runGraphStructuralAudit(d);
  assert.ok(audit.warnings.some((w) => w.code === 'dead_end_branch'));
}

// --- cyclic graph ---
{
  const d = doc({
    nodes: [
      { id: 'a', type: 'start', position: { x: 0, y: 0 } },
      { id: 'b', type: 'message', position: { x: 0, y: 100 }, data: { text: 'loop' } },
    ],
    edges: [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'a' },
    ],
  });
  const conn = validateGraphConnections(d);
  assert.ok(conn.some((x) => x.code === 'cyclic_loop'));
}

// --- duplicate connection ---
{
  const d = doc({
    nodes: [
      { id: 'a', type: 'start', position: { x: 0, y: 0 } },
      { id: 'b', type: 'message', position: { x: 0, y: 100 }, data: { text: 'x' } },
    ],
    edges: [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'a', target: 'b' },
    ],
  });
  assert.ok(validateGraphConnections(d).some((x) => x.code === 'duplicate_edge'));
  const add = applyOperation(d, createOperation('AddEdge', { edgeId: 'e3', source: 'a', target: 'b' }));
  assert.equal(add.ok, false);
}

// --- missing handler chain (message dead-end) ---
{
  const d = doc({
    nodes: [
      { id: 'st', type: 'start', position: { x: 0, y: 0 } },
      { id: 'm', type: 'message', position: { x: 0, y: 100 }, data: { text: 'end' } },
    ],
    edges: [{ id: 'e1', source: 'st', target: 'm' }],
  });
  const audit = runGraphStructuralAudit(d);
  assert.ok(audit.warnings.some((w) => w.code === 'dead_end_chain'));
}

// --- orphan node (disconnected message) ---
{
  const d = doc({
    nodes: [
      { id: 'st', type: 'start', position: { x: 0, y: 0 } },
      { id: 'lonely', type: 'message', position: { x: 300, y: 0 }, data: { text: 'orphan' } },
    ],
    edges: [],
  });
  const orphans = detectOrphanNodes(d);
  assert.ok(orphans.some((x) => x.nodeId === 'lonely'));
  const unreachable = detectUnreachableChains(d);
  assert.ok(unreachable.some((x) => x.nodeId === 'lonely'));
}

// --- self-connection rejected at VM ---
{
  const d = doc({
    nodes: [{ id: 'a', type: 'message', position: { x: 0, y: 0 }, data: { text: 'x' } }],
    edges: [],
  });
  const r = applyOperation(d, createOperation('AddEdge', { edgeId: 'e', source: 'a', target: 'a' }));
  assert.equal(r.ok, false);
}

// --- incompatible connection: terminal → flow ---
{
  const d = doc({
    nodes: [
      { id: 'm', type: 'message', position: { x: 0, y: 0 }, data: { text: 'a' } },
      { id: 'g', type: 'goto', position: { x: 0, y: 100 }, data: { target: 'main' } },
    ],
    edges: [],
  });
  const v = validateConnectionRequest(d, { source: 'g', target: 'm' });
  assert.equal(v.ok, false);
  assert.match(v.reason, /terminal|no output/i);
}

// --- palette composition rejects invalid AddEdge ---
{
  const stacks = [{ id: 'stack_1', blocks: [{ id: 'b1', type: 'start' }] }];
  const result = compileAddBlockToStack(stacks, 'stack_1', { id: 'b2', type: 'bot', props: { token: 'x' } });
  assert.equal(result.ok, false);
}

// --- valid minimal graph passes ---
{
  const d = doc({
    nodes: [
      { id: 'st', type: 'start', position: { x: 0, y: 0 } },
      { id: 'm', type: 'message', position: { x: 0, y: 100 }, data: { text: 'ok' } },
    ],
    edges: [{ id: 'e1', source: 'st', target: 'm' }],
  });
  const audit = runGraphStructuralAudit(d);
  assert.equal(audit.ok, true, JSON.stringify(audit.errors));
  assert.equal(canConnect('start', 'message').ok, true);
}

console.log('graph_structural_audit.test.js: all tests passed');
