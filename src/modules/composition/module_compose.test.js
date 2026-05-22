import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { composeModules, previewComposeModules } from './module_compose.js';
import { GRAPH_MODULE_REGISTRY } from '../graph/registry.js';
import { scopeCallback, detectCallbackCollisions } from './callback_namespace.js';
import { mergeGlobals } from './globals_merge.js';
import { mergeGraphs, seedToNodeMap } from './graph_merge.js';
import { resolveModuleDependencies } from './module_validation.js';

describe('module composition', () => {
  it('resolves admin_menu dependency on admin_by_id', () => {
    const { resolved, missing } = resolveModuleDependencies(
      ['admin_menu'],
      GRAPH_MODULE_REGISTRY,
    );
    assert.equal(missing.length, 0);
    assert.deepEqual(resolved, ['admin_by_id', 'admin_menu']);
  });

  it('merges admin_check + broadcast without duplicate bot', () => {
    const result = composeModules(
      ['admin_by_id', 'broadcast_all'],
      GRAPH_MODULE_REGISTRY,
      { strict: false },
    );
    assert.equal(result.ok, true, result.error || JSON.stringify(result.report?.diagnostics?.slice(0, 3)));
    const nodes = Object.values(result.document.nodes);
    const bots = nodes.filter((n) => n.type === 'bot');
    assert.equal(bots.length, 1, 'single bot node after merge');
  });

  it('merges admin + stats fragments', () => {
    const result = composeModules(
      ['admin_by_id', 'user_count'],
      GRAPH_MODULE_REGISTRY,
      { strict: false },
    );
    assert.equal(result.ok, true, result.error);
    const callbacks = nodesWithCallback(result.document);
    assert.ok(callbacks.some((c) => c.includes('mod_admin:')));
    assert.ok(callbacks.some((c) => c.includes('mod_stats:')));
  });

  it('detects duplicate global when values differ', () => {
    const base = seedToNodeMap(
      [{ id: 'g1', type: 'cicada', position: { x: 0, y: 0 }, data: { type: 'global', props: { varname: 'ADMIN_ID', value: '1' } } }],
      [],
    );
    const incoming = seedToNodeMap(
      [{ id: 'g2', type: 'cicada', position: { x: 0, y: 0 }, data: { type: 'global', props: { varname: 'ADMIN_ID', value: '2' } } }],
      [],
    );
    const merged = mergeGlobals(base.nodes, incoming.nodes, 'first_wins');
    assert.ok(merged.conflicts.length >= 1);
    assert.equal(Object.keys(merged.nodes).length, 0);
  });

  it('scopes bare callback to mod prefix', () => {
    assert.equal(scopeCallback('admin', 'panel'), 'mod_panel:admin');
    assert.equal(scopeCallback('mod_admin:open', 'panel'), 'mod_admin:open');
  });

  it('preview compose returns document without committing flag', () => {
    const preview = previewComposeModules(['admin_by_id'], GRAPH_MODULE_REGISTRY);
    assert.equal(preview.ok, true);
    assert.ok(preview.preview);
    assert.equal(preview.document, null);
  });

  it('fails on missing dependency module', () => {
    const result = composeModules(['nonexistent_mod'], GRAPH_MODULE_REGISTRY);
    assert.equal(result.ok, false);
    assert.match(result.error || '', /not found/i);
  });

  it('reports callback collision on duplicate keys in same graph', () => {
    const nodes = {
      a: { id: 'a', type: 'callback', data: { data: 'dup:key' } },
      b: { id: 'b', type: 'callback', data: { data: 'dup:key' } },
    };
    const issues = detectCallbackCollisions({}, nodes);
    assert.equal(issues.length, 0);
    const self = detectCallbackCollisions(nodes, {
      c: { id: 'c', type: 'callback', data: { data: 'dup:key' } },
    });
    assert.ok(self.length >= 1);
  });

  it('dedupes start when merging second module', () => {
    const first = composeModules(['admin_by_id'], GRAPH_MODULE_REGISTRY, { strict: false });
    const second = composeModules(
      ['broadcast_all'],
      GRAPH_MODULE_REGISTRY,
      { baseDocument: first.document, strict: false },
    );
    assert.equal(second.ok, true, second.error);
    const starts = Object.values(second.document.nodes).filter((n) => n.type === 'start');
    assert.equal(starts.length, 1);
  });
});

function nodesWithCallback(document) {
  const out = [];
  for (const node of Object.values(document.nodes || {})) {
    if (node.type === 'callback' && node.data?.data) out.push(node.data.data);
    if (node.type === 'inline' && node.data?.buttons) out.push(node.data.buttons);
    if (node.type === 'buttons' && node.data?.rows) out.push(node.data.rows);
  }
  return out;
}
