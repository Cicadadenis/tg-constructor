import test from 'node:test';
import assert from 'node:assert/strict';
import { GRAPH_MODULE_REGISTRY, GRAPH_MODULE_SUITES } from '../graph/registry.js';
import { classifyModule } from './module_catalog.js';
import { migrateLegacyDslModule, dslCodeToStacks } from './migrate_legacy_dsl.js';
import {
  runInsertionPreview,
  commitInsertion,
  withAutoDependencies,
} from './module_insertion_pipeline.js';
import { analyzeGraphTopology } from './topology_preview.js';

test('classifyModule: graph vs legacy', () => {
  const graph = classifyModule('admin_by_id', GRAPH_MODULE_REGISTRY);
  assert.equal(graph.kind, 'graph');
  assert.equal(graph.canInsert, true);
  const legacy = classifyModule('unknown_legacy', GRAPH_MODULE_REGISTRY, {
    builtinById: {
      unknown_legacy: { id: 'unknown_legacy', name: 'X', code: 'старт:\n    ответ "Hi"' },
    },
  });
  assert.equal(legacy.kind, 'legacy_dsl');
  assert.equal(legacy.canMigrate, true);
});

test('resolve admin_menu dependencies with human message', () => {
  const preview = runInsertionPreview(['admin_menu'], GRAPH_MODULE_REGISTRY);
  assert.equal(preview.ok, true);
  assert.ok(preview.resolvedDependencies.includes('admin_by_id'));
});

test('compose admin suite dedupes bot', () => {
  const result = commitInsertion(
    [...GRAPH_MODULE_SUITES.admin_suite],
    GRAPH_MODULE_REGISTRY,
    { strict: false },
  );
  assert.equal(result.ok, true, result.error);
  const bots = Object.values(result.document.nodes).filter((n) => n.type === 'bot');
  assert.equal(bots.length, 1);
});

test('withAutoDependencies adds missing module', () => {
  const ids = withAutoDependencies(['admin_menu'], GRAPH_MODULE_REGISTRY);
  assert.ok(ids.includes('admin_by_id'));
  assert.ok(ids.includes('admin_menu'));
});

test('DSL migration produces graph document', () => {
  const stacks = dslCodeToStacks('бот "T"\nстарт:\n    ответ "Hi"', 'test_mod');
  assert.ok(stacks[0].blocks.some((b) => b.type === 'start'));
  const migrated = migrateLegacyDslModule({
    id: 'test_legacy',
    name: 'Test',
    code: 'бот "T"\nстарт:\n    ответ "Hi"\n    кнопки "Go"',
  }, {});
  assert.equal(migrated.ok, true);
  assert.ok(migrated.document.nodes);
  const topo = analyzeGraphTopology(migrated.document);
  assert.ok(topo.nodeCount >= 2);
});

test('insertion preview topology stats', () => {
  const preview = runInsertionPreview(['admin_by_id'], GRAPH_MODULE_REGISTRY);
  assert.equal(preview.ok, true);
  assert.ok(preview.topology.nodeCount > 0);
  assert.ok(preview.topology.edgeCount >= 0);
});
