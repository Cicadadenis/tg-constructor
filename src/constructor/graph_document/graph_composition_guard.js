/**
 * Semantic firewall guards — DSL expansion, layer isolation, dependency graph.
 */

import { GRAPH_OPERATION_TYPES } from './graph_schema.js';
import {
  scanCompilerLayerSource,
  scanRuntimeClientSource,
  scanVmLayerSource,
  analyzeLayerDependencyGraph,
  extractModuleImportSpecifiers,
} from './graph_compiler_vm_contract.js';

const FORBIDDEN_COMPOSITION_DSL_TYPES = [
  'ReplaceGraphDocument',
  'MutateStacks',
  'ReplaceStacks',
  'PatchGraph',
  'MergeGraphSnapshot',
  'SetGraphState',
  'UpdateGraph',
];

const HIDDEN_DSL_PATTERNS = [
  /\bcreateOperation\s*\(\s*['"](?!AddNode|RemoveNode|MoveNode|UpdateNodeData|AddEdge|RemoveEdge|UpdateEdge|UpdateViewport|GroupSelection)[^'"]+['"]/,
  /\bdispatch\s*\(\s*['"](?!AddNode|RemoveNode|MoveNode|UpdateNodeData|AddEdge|RemoveEdge|UpdateEdge|UpdateViewport|GroupSelection)[^'"]+['"]/,
  /\bexport\s+function\s+(mutate|replace)[A-Z]\w*(Graph|Stacks|Document)\b/,
  /\bfunction\s+(mutate|replace)[A-Z]\w*(Graph|Stacks|Document)\s*\(/,
];

const COMPOSITION_GUARD_ALLOWLIST = [
  'graph_operations.js',
  'graph_operation_client.js',
  'graph_ui_compositions.js',
  'graph_ui_orchestrator.js',
  'graph_compiler_vm_contract.js',
  'graph_composition_guard.js',
  'graph_schema.js',
  'graph_history.js',
  'graph_migration.js',
  'graph_import.js',
  'graph_projection.js',
  'graph_editor_store.js',
  'graph_stack_ops.js',
  'graph_document.test.js',
  'graph_mutation_guard.js',
];

const LAYER_SCANNERS = {
  'graph_ui_compositions.js': scanCompilerLayerSource,
  'graph_operation_client.js': scanRuntimeClientSource,
  'graph_operations.js': scanVmLayerSource,
};

export function isCompositionGuardAllowlisted(filePath = '') {
  const normalized = String(filePath).replace(/\\/g, '/');
  return COMPOSITION_GUARD_ALLOWLIST.some((name) => normalized.endsWith(name));
}

function layerScannerForFile(filePath = '') {
  const normalized = filePath.replace(/\\/g, '/');
  for (const [suffix, scanner] of Object.entries(LAYER_SCANNERS)) {
    if (normalized.endsWith(suffix)) return scanner;
  }
  return null;
}

/**
 * Detect dispatch/createOperation with non-canonical type literals (hidden DSL).
 */
export function scanSourceForHiddenCompositionDSL(source, options = {}) {
  const hits = [];
  const filePath = options.filePath || '';

  const layerScanner = layerScannerForFile(filePath);
  if (layerScanner) {
    hits.push(...layerScanner(source, { filePath }));
  }

  if (isCompositionGuardAllowlisted(filePath) && !layerScanner) {
    return hits;
  }

  for (const forbidden of FORBIDDEN_COMPOSITION_DSL_TYPES) {
    if (source.includes(`'${forbidden}'`) || source.includes(`"${forbidden}"`)) {
      hits.push({
        pattern: forbidden,
        reason: `Forbidden mutation DSL type: ${forbidden}. Compose ${GRAPH_OPERATION_TYPES.join(', ')} only.`,
      });
    }
  }

  for (const pattern of HIDDEN_DSL_PATTERNS) {
    if (pattern.test(source)) {
      hits.push({
        pattern: String(pattern),
        reason: 'Hidden composition DSL expansion detected; use graph_ui_compositions compile functions',
      });
    }
  }

  const dispatchLiteralRe = /\bdispatch\s*\(\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = dispatchLiteralRe.exec(source)) !== null) {
    const type = m[1];
    if (!GRAPH_OPERATION_TYPES.includes(type)) {
      hits.push({
        pattern: `dispatch('${type}')`,
        reason: `dispatch type "${type}" is not in GRAPH_OPERATION_TYPES`,
      });
    }
  }

  return hits;
}

/**
 * Scan a set of graph_document module sources for forbidden layer dependency chains.
 * @param {Array<{ filePath: string, source: string }>} modules
 */
export function scanLayerDependencyViolations(modules) {
  return analyzeLayerDependencyGraph(modules);
}

export {
  scanCompilerLayerSource,
  scanRuntimeClientSource,
  scanVmLayerSource,
  analyzeLayerDependencyGraph,
  extractModuleImportSpecifiers,
  FORBIDDEN_COMPOSITION_DSL_TYPES,
  COMPOSITION_GUARD_ALLOWLIST,
};
