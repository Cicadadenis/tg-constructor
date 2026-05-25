import assert from 'node:assert/strict';
import test from 'node:test';

import '../node_manifest/init.mjs';
import {
  runStaticStartupIntegrityCheck,
  validateRegisteredNodeTypes,
  validateGraphSchemas,
  validateCompiledGraphDocument,
  formatStartupIntegrityReport,
} from '../startup/startupIntegrityCheck.mjs';

test('static startup integrity passes for current registry', () => {
  const result = runStaticStartupIntegrityCheck();
  assert.equal(result.ok, true, formatStartupIntegrityReport(result));
  assert.equal(result.violations.length, 0);
});

test('validateRegisteredNodeTypes returns no violations', () => {
  assert.equal(validateRegisteredNodeTypes().length, 0);
});

test('validateGraphSchemas returns no violations', () => {
  assert.equal(validateGraphSchemas().length, 0);
});

test('compiled graph with unknown node type is reported', () => {
  const violations = validateCompiledGraphDocument('proj-1', 'Test Bot', {
    schema_version: 2,
    nodes: {
      n1: { id: 'n1', type: 'not_a_real_block_type_xyz', position: { x: 0, y: 0 }, data: {} },
    },
    edges: {},
    metadata: { name: 'x', revision: 0, tags: [] },
    viewport: { x: 0, y: 0, zoom: 1 },
    ui_state: { selection: [], collapsed: [], groups: [] },
  });
  assert.ok(violations.length > 0);
  assert.ok(
    violations.some((v) => v.section === 'compiled_graphs' && v.code === 'unknown_block_type'),
  );
});

test('integrity report includes section summary', () => {
  const report = formatStartupIntegrityReport({
    violations: [
      {
        section: 'node_types',
        code: 'test',
        message: 'example',
      },
    ],
    sections: { node_types: 1 },
  });
  assert.match(report, /STARTUP INTEGRITY CHECK FAILED/);
  assert.match(report, /\[node_types\]/);
  assert.match(report, /Total violations: 1/);
});
