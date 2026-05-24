/**
 * Startup integrity gate — registry, graph schemas, persisted compiled graphs.
 * Blocks server boot when any violation is found.
 */

import { blockDefinitions } from '../blockRegistry.js';
import { parseTruthyFlag } from '../env.mjs';
import { collectRegistryViolations } from '../validation/registryEnforce.js';
import { getNodeManifestRegistry } from '../node_manifest/nodeManifestRegistry.mjs';
import { assertValidExecutionContract } from '../node_manifest/executionContract.mjs';
import {
  GraphDocumentRecordSchema,
  GraphEdgeSchema,
  GraphNodeSchema,
} from '../../src/constructor/graph_document/contracts.js';
import { GRAPH_DOCUMENT_SCHEMA_VERSION } from '../../src/constructor/graph_document/graph_schema.js';
import { isGraphDocumentShape } from '../../src/constructor/graph_document/graph_schema.js';
import { GraphDocumentValidator } from '../../src/constructor/graph_document/graph_validator.js';

/** @typedef {{ code: string, message: string, section: string, details?: Record<string, unknown> }} IntegrityViolation */

/**
 * @param {string} section
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {IntegrityViolation}
 */
function violation(section, code, message, details = undefined) {
  return { section, code, message, ...(details ? { details } : {}) };
}

export function isStartupIntegrityCheckEnabled() {
  return !parseTruthyFlag(process.env.SKIP_STARTUP_INTEGRITY);
}

/**
 * Validate blockRegistry ↔ operation registry alignment and block definition integrity.
 * @returns {IntegrityViolation[]}
 */
export function validateRegisteredNodeTypes() {
  /** @type {IntegrityViolation[]} */
  const violations = [];
  const registry = getNodeManifestRegistry();
  const manifestTypes = new Set(registry.types());
  const seenTypes = new Set();

  for (const def of blockDefinitions) {
    const type = String(def?.type || '').trim();
    if (!type) {
      violations.push(
        violation('node_types', 'empty_block_type', 'Block definition has empty type'),
      );
      continue;
    }
    if (seenTypes.has(type)) {
      violations.push(
        violation('node_types', 'duplicate_block_type', `Duplicate block type "${type}"`, {
          type,
        }),
      );
    }
    seenTypes.add(type);

    if (!registry.has(type)) {
      violations.push(
        violation(
          'node_types',
          'missing_node_manifest',
          `NodeManifestRegistry missing manifest for type "${type}"`,
          { type },
        ),
      );
      continue;
    }

    const manifest = registry.get(type);
    if (!manifest.inputs?.schema || !manifest.outputs?.ports) {
      violations.push(
        violation(
          'node_types',
          'incomplete_node_manifest',
          `NodeManifest for "${type}" is missing inputs/outputs schema`,
          { type },
        ),
      );
    }
    if (!manifest.executionContract) {
      violations.push(
        violation(
          'node_types',
          'missing_execution_contract',
          `NodeManifest for "${type}" has no executionContract`,
          { type },
        ),
      );
    } else {
      try {
        assertValidExecutionContract(manifest.executionContract, { type });
      } catch (err) {
        violations.push(
          violation(
            'node_types',
            'invalid_execution_contract',
            `NodeManifest for "${type}": ${err instanceof Error ? err.message : String(err)}`,
            { type },
          ),
        );
      }
    }
  }

  for (const type of manifestTypes) {
    if (!seenTypes.has(type)) {
      violations.push(
        violation(
          'node_types',
          'orphan_node_manifest',
          `NodeManifest "${type}" has no blockDefinitions entry`,
          { type },
        ),
      );
    }
  }

  if (registry.size !== blockDefinitions.length) {
    violations.push(
      violation(
        'node_types',
        'manifest_count_mismatch',
        `NodeManifestRegistry size (${registry.size}) != blockDefinitions (${blockDefinitions.length})`,
      ),
    );
  }

  return violations;
}

/**
 * Validate Zod graph document schemas and per-type node shape samples.
 * @returns {IntegrityViolation[]}
 */
export function validateGraphSchemas() {
  /** @type {IntegrityViolation[]} */
  const violations = [];

  if (GRAPH_DOCUMENT_SCHEMA_VERSION < 1) {
    violations.push(
      violation(
        'graph_schemas',
        'invalid_schema_version_constant',
        `GRAPH_DOCUMENT_SCHEMA_VERSION must be >= 1 (got ${GRAPH_DOCUMENT_SCHEMA_VERSION})`,
      ),
    );
  }

  const minimalNode = {
    id: '__integrity_probe__',
    type: blockDefinitions[0]?.type || 'message',
    position: { x: 0, y: 0 },
    data: {},
    meta: {},
  };

  const nodeProbe = GraphNodeSchema.safeParse(minimalNode);
  if (!nodeProbe.success) {
    violations.push(
      violation(
        'graph_schemas',
        'graph_node_schema_invalid',
        `GraphNodeSchema probe failed: ${nodeProbe.error.message}`,
      ),
    );
  }

  const edgeProbe = GraphEdgeSchema.safeParse({
    id: 'e_probe',
    source: minimalNode.id,
    target: minimalNode.id,
    sourcePort: 'flow',
    targetPort: 'flow',
  });
  if (!edgeProbe.success) {
    violations.push(
      violation(
        'graph_schemas',
        'graph_edge_schema_invalid',
        `GraphEdgeSchema probe failed: ${edgeProbe.error.message}`,
      ),
    );
  }

  const recordProbe = GraphDocumentRecordSchema.safeParse({
    schema_version: GRAPH_DOCUMENT_SCHEMA_VERSION,
    nodes: {
      [minimalNode.id]: minimalNode,
    },
    edges: {},
    metadata: { name: 'integrity-probe', revision: 0, tags: [] },
    viewport: { x: 0, y: 0, zoom: 1 },
    ui_state: { selection: [], collapsed: [], groups: [] },
  });
  if (!recordProbe.success) {
    violations.push(
      violation(
        'graph_schemas',
        'graph_document_schema_invalid',
        `GraphDocumentRecordSchema probe failed: ${recordProbe.error.message}`,
      ),
    );
  }

  for (const def of blockDefinitions) {
    const type = def.type;
    const sample = {
      id: `probe_${type}`,
      type,
      position: { x: 0, y: 0 },
      data: {},
      meta: {},
    };
    const parsed = GraphNodeSchema.safeParse(sample);
    if (!parsed.success) {
      violations.push(
        violation(
          'graph_schemas',
          'registered_type_schema_reject',
          `GraphNodeSchema rejects registered type "${type}": ${parsed.error.issues[0]?.message || parsed.error.message}`,
          { type },
        ),
      );
    }
  }

  return violations;
}

/**
 * @param {unknown} graphDocument
 * @returns {Array<{ id?: string, type?: string, data?: object }>}
 */
function extractGraphNodes(graphDocument) {
  if (!graphDocument || typeof graphDocument !== 'object') return [];
  const nodes = /** @type {Record<string, unknown>} */ (graphDocument).nodes;
  if (!nodes) return [];
  if (Array.isArray(nodes)) return nodes;
  if (typeof nodes === 'object') return Object.values(nodes);
  return [];
}

/**
 * @param {string} projectId
 * @param {string} projectName
 * @param {unknown} graphDocument
 * @returns {IntegrityViolation[]}
 */
export function validateCompiledGraphDocument(projectId, projectName, graphDocument) {
  /** @type {IntegrityViolation[]} */
  const violations = [];
  const label = projectName ? `${projectName} (${projectId})` : projectId;

  if (!graphDocument || typeof graphDocument !== 'object') {
    return violations;
  }

  const nodes = extractGraphNodes(graphDocument);
  if (nodes.length === 0) {
    return violations;
  }

  for (const regViolation of collectRegistryViolations(nodes)) {
    violations.push(
      violation(
        'compiled_graphs',
        regViolation.code,
        `Project ${label}: ${regViolation.message}`,
        {
          projectId,
          projectName,
          nodeId: regViolation.nodeId,
          type: regViolation.type,
        },
      ),
    );
  }

  if (!isGraphDocumentShape(graphDocument)) {
    violations.push(
      violation(
        'compiled_graphs',
        'invalid_graph_document_shape',
        `Project ${label}: graph_document is not a valid GraphDocument shape`,
        { projectId, projectName },
      ),
    );
    return violations;
  }

  try {
    const validator = new GraphDocumentValidator();
    const structural = validator.validate(graphDocument);
    if (!structural.ok) {
      for (const issue of structural.issues.slice(0, 20)) {
        violations.push(
          violation(
            'compiled_graphs',
            issue.code || 'structural_invalid',
            `Project ${label}: ${issue.message}`,
            {
              projectId,
              projectName,
              nodeId: issue.nodeId,
              edgeId: issue.edgeId,
            },
          ),
        );
      }
      if (structural.issues.length > 20) {
        violations.push(
          violation(
            'compiled_graphs',
            'structural_invalid_truncated',
            `Project ${label}: ${structural.issues.length - 20} additional structural issue(s) omitted`,
            { projectId, projectName, total: structural.issues.length },
          ),
        );
      }
    }
  } catch (err) {
    const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : '';
    if (name === 'UnknownBlockTypeError') {
      violations.push(
        violation(
          'compiled_graphs',
          'unknown_block_type',
          `Project ${label}: ${err instanceof Error ? err.message : String(err)}`,
          {
            projectId,
            projectName,
            nodeId: err?.nodeId,
            type: err?.type,
          },
        ),
      );
    } else {
      violations.push(
        violation(
          'compiled_graphs',
          'graph_validation_error',
          `Project ${label}: ${err instanceof Error ? err.message : String(err)}`,
          { projectId, projectName },
        ),
      );
    }
  }

  return violations;
}

/**
 * Scan persisted project graphs for unknown / invalid node types.
 * @param {import('pg').Pool} pool
 * @param {{ limit?: number }} [options]
 * @returns {Promise<IntegrityViolation[]>}
 */
export async function validatePersistedCompiledGraphs(pool, options = {}) {
  /** @type {IntegrityViolation[]} */
  const violations = [];
  const limit = Number.isFinite(options.limit) ? options.limit : 10_000;

  const { rows } = await pool.query(
    `SELECT id, name, graph_document
     FROM projects
     WHERE graph_document IS NOT NULL
       AND graph_document::text <> '{}'
     ORDER BY updated_at DESC NULLS LAST
     LIMIT $1`,
    [limit],
  );

  for (const row of rows) {
    const projectId = String(row.id);
    const projectName = String(row.name || '');
    const graphDocument = row.graph_document;
    violations.push(
      ...validateCompiledGraphDocument(projectId, projectName, graphDocument),
    );
  }

  return violations;
}

/**
 * Static checks only (no database).
 * @returns {{ ok: boolean, violations: IntegrityViolation[] }}
 */
export function runStaticStartupIntegrityCheck() {
  const violations = [
    ...validateRegisteredNodeTypes(),
    ...validateGraphSchemas(),
  ];
  return { ok: violations.length === 0, violations };
}

/**
 * Full startup integrity gate.
 * @param {{ pool?: import('pg').Pool | null, skipPersistedGraphs?: boolean }} [options]
 * @returns {Promise<{ ok: boolean, violations: IntegrityViolation[], sections: Record<string, number> }>}
 */
export async function runStartupIntegrityCheck(options = {}) {
  if (!isStartupIntegrityCheckEnabled()) {
    return { ok: true, violations: [], sections: {} };
  }

  const violations = [...validateRegisteredNodeTypes(), ...validateGraphSchemas()];

  if (options.pool && !options.skipPersistedGraphs) {
    try {
      violations.push(...(await validatePersistedCompiledGraphs(options.pool)));
    } catch (err) {
      violations.push(
        violation(
          'compiled_graphs',
          'scan_failed',
          `Failed to scan persisted graphs: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    }
  }

  /** @type {Record<string, number>} */
  const sections = {};
  for (const v of violations) {
    sections[v.section] = (sections[v.section] || 0) + 1;
  }

  return { ok: violations.length === 0, violations, sections };
}

/**
 * Log a full diagnostic report to stderr and return formatted text.
 * @param {{ violations: IntegrityViolation[], sections?: Record<string, number> }} result
 * @returns {string}
 */
export function formatStartupIntegrityReport(result) {
  const lines = [
    '',
    '══════════════════════════════════════════════════════════════',
    'STARTUP INTEGRITY CHECK FAILED',
    '══════════════════════════════════════════════════════════════',
  ];

  if (result.sections && Object.keys(result.sections).length) {
    lines.push('', 'Summary by section:');
    for (const [section, count] of Object.entries(result.sections)) {
      lines.push(`  - ${section}: ${count}`);
    }
  }

  const bySection = new Map();
  for (const v of result.violations) {
    if (!bySection.has(v.section)) bySection.set(v.section, []);
    bySection.get(v.section).push(v);
  }

  for (const [section, items] of bySection) {
    lines.push('', `[${section}] (${items.length} violation(s))`);
    for (const item of items) {
      lines.push(`  • [${item.code}] ${item.message}`);
      if (item.details && Object.keys(item.details).length) {
        lines.push(`    ${JSON.stringify(item.details)}`);
      }
    }
  }

  lines.push(
    '',
    `Total violations: ${result.violations.length}`,
    'Startup blocked until integrity issues are resolved.',
    'Set SKIP_STARTUP_INTEGRITY=1 only for emergency local recovery.',
    '══════════════════════════════════════════════════════════════',
    '',
  );

  return lines.join('\n');
}

/**
 * @param {{ violations: IntegrityViolation[], sections?: Record<string, number> }} result
 */
export function logStartupIntegrityReport(result) {
  const report = formatStartupIntegrityReport(result);
  console.error(report);
  return report;
}
