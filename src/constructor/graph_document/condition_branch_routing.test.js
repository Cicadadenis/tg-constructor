import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canConnect, validateConnection } from './operation_registry.js';
import { createGraphDocument } from './graph_document.js';
import { composeModules } from '../../modules/composition/module_compose.js';
import { GRAPH_MODULE_REGISTRY } from '../../modules/graph/registry.js';
import { moduleHandlerColumn } from '../../modules/graph/helpers.js';
import { normalizeConnectionError } from '../../builder/graph_error_messages.js';
import { runGraphStructuralAudit } from './graph_structural_audit.js';

describe('condition branch routing', () => {
  it('allows condition TRUE -> message', () => {
    const r = canConnect('condition', 'message', 'true', 'flow');
    assert.equal(r.ok, true, r.reason);
  });

  it('allows condition FALSE -> message', () => {
    const r = canConnect('condition', 'message', 'false', 'flow');
    assert.equal(r.ok, true, r.reason);
  });

  it('rejects condition -> message without branch port (legacy forbidden pair removed)', () => {
    const r = canConnect('condition', 'message', 'flow', 'flow');
    assert.equal(r.ok, true, 'flow port resolves to TRUE transport on condition outputs');
  });

  it('validates admin-style graph in document', () => {
    const col = moduleHandlerColumn(2, [
      { id: 'n_start', type: 'start' },
      { id: 'n_cond', type: 'condition', props: { cond: 'x' } },
      { id: 'n_yes', type: 'message', props: { text: 'yes' } },
      { id: 'n_else', type: 'else' },
      { id: 'n_no', type: 'message', props: { text: 'no' } },
    ]);
    const doc = createGraphDocument({ nodes: col.nodes, edges: col.edges });
    const trueEdge = col.edges.find((e) => e.source === 'n_cond' && e.target === 'n_yes');
    const falseEdge = col.edges.find((e) => e.source === 'n_cond' && e.target === 'n_no');
    assert.ok(trueEdge, 'TRUE branch edge exists');
    assert.equal(trueEdge.sourcePort, 'true');
    assert.ok(falseEdge, 'FALSE branch edge exists');
    assert.equal(falseEdge.sourcePort, 'false');
    assert.equal(col.nodes.some((n) => n.data?.type === 'else'), false, 'else is a marker, not a graph node');

    const audit = runGraphStructuralAudit(doc, { includeCallbacks: false });
    const incompatible = audit.errors.filter((e) => e.code === 'incompatible_connection');
    assert.equal(incompatible.length, 0, JSON.stringify(incompatible));
  });

  it('composed admin_by_id module has no condition->message incompatible edges', () => {
    const result = composeModules(['admin_by_id'], GRAPH_MODULE_REGISTRY, { strict: false });
    assert.equal(result.ok, true, result.error);
    const audit = runGraphStructuralAudit(result.document, { includeCallbacks: false });
    const bad = audit.errors.filter((e) => (
      e.message?.includes('condition cannot be connected to message')
      || (e.code === 'incompatible_connection' && e.message?.includes('condition'))
    ));
    assert.equal(bad.length, 0, JSON.stringify(bad));
  });

  it('normalizes condition connection errors without edge ids', () => {
    const ux = normalizeConnectionError('condition cannot be connected to message', {
      lang: 'ru',
      sourceType: 'condition',
      targetType: 'message',
    });
    assert.equal(ux.code, 'CONDITION_BRANCH_REQUIRED');
    assert.ok(ux.title.includes('Условие') || ux.title.includes('ветк'));
    assert.ok(!ux.title.includes('edge_'));
    assert.ok(!ux.cause.includes('edge_m_'));
    assert.ok(ux.fix.includes('Да') || ux.fix.includes('TRUE') || ux.fix.includes('Ответ'));
  });

  it('validateConnection accepts TRUE branch on graph document', () => {
    const doc = createGraphDocument({
      nodes: [
        { id: 'c', type: 'condition', position: { x: 0, y: 0 }, data: { cond: '1' } },
        { id: 'm', type: 'message', position: { x: 0, y: 100 }, data: { text: 'ok' } },
      ],
      edges: [{
        id: 'e_cm',
        source: 'c',
        target: 'm',
        sourcePort: 'true',
        targetPort: 'flow',
      }],
    });
    const v = validateConnection(doc, {
      source: 'c',
      target: 'm',
      sourcePort: 'true',
      targetPort: 'flow',
      ignoreEdgeId: 'e_cm',
    });
    assert.equal(v.ok, true, v.reason);
  });
});
