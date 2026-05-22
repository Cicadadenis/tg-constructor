/**
 * Compiler ↔ VM semantic firewall — contract, strict validation, layer import graph.
 */

import { GRAPH_OPERATION_TYPES, normalizeOperationType } from './graph_schema.js';

export const COMPILER_LAYER = 'graph_ui_compositions';
export const RUNTIME_CLIENT_LAYER = 'graph_operation_client';
export const ORCHESTRATOR_LAYER = 'graph_ui_orchestrator';
export const VM_LAYER = 'graph_operations';

/** When true, dispatch and applyComposition reject any non-canonical / malformed IR. */
export const STRICT_VM_SEMANTICS_MODE = true;

export const LAYER_MODULE_FILES = Object.freeze({
  [COMPILER_LAYER]: 'graph_ui_compositions.js',
  [RUNTIME_CLIENT_LAYER]: 'graph_operation_client.js',
  [ORCHESTRATOR_LAYER]: 'graph_ui_orchestrator.js',
  [VM_LAYER]: 'graph_operations.js',
});

/** Directed forbidden edges: fromLayer → must not import modules of toLayer. */
export const FORBIDDEN_LAYER_IMPORTS = Object.freeze({
  [COMPILER_LAYER]: [
    VM_LAYER,
    RUNTIME_CLIENT_LAYER,
    ORCHESTRATOR_LAYER,
    'graph_editor_store',
    'graph_history',
    'graph_migration',
    'graph_projection',
  ],
  [RUNTIME_CLIENT_LAYER]: [COMPILER_LAYER, ORCHESTRATOR_LAYER],
  [VM_LAYER]: [COMPILER_LAYER, RUNTIME_CLIENT_LAYER, ORCHESTRATOR_LAYER],
});

export const COMPILER_FORBIDDEN_IMPORTS = Object.freeze([
  './graph_operations.js',
  './graph_editor_store.js',
  './graph_history.js',
  './graph_migration.js',
  './graph_operation_client.js',
  './graph_ui_orchestrator.js',
  './graph_projection.js',
  'graph_operations',
  'graph_operation_client',
  'graph_ui_orchestrator',
  'graph_editor_store',
  'applyOperation',
  'createGraphEditorStore',
  'replayOperations',
]);

export const RUNTIME_CLIENT_FORBIDDEN_IMPORTS = Object.freeze([
  './graph_ui_compositions.js',
  './graph_ui_orchestrator.js',
  'graph_ui_compositions',
  'graph_ui_orchestrator',
]);

export const VM_FORBIDDEN_IMPORTS = Object.freeze([
  './graph_ui_compositions.js',
  './graph_operation_client.js',
  './graph_ui_orchestrator.js',
  'graph_ui_compositions',
  'graph_operation_client',
  'graph_ui_orchestrator',
]);

export const COMPILER_FORBIDDEN_PATTERNS = Object.freeze([
  /\b\.dispatch\s*\(/,
  /\bdispatch\s*\(/,
  /\bapplyOperation\s*\(/,
  /\bcreateGraphEditorStore\s*\(/,
  /\bgetGraphDocument\s*\(/,
  /\breplayOperations\s*\(/,
  /\bstore\.dispatch\b/,
  /export\s+function\s+applyComposition\b/,
  /\bimport\s*\(/,
  /\bReflect\.(?:get|apply|construct)\b/,
  /\bnew\s+Function\s*\(/,
  /\beval\s*\(/,
  /\b__proto__\b/,
  /\bObject\.defineProperty\s*\(/,
]);

export const RUNTIME_CLIENT_FORBIDDEN_PATTERNS = Object.freeze([
  /export\s+function\s+compile[A-Z]\w*\s*\(/,
  /function\s+compositionOp\s*\(/,
  /export\s+function\s+compositionOp\b/,
  /\bimport\s*\(/,
  /\bReflect\.(?:get|apply|construct)\b/,
  /\bnew\s+Function\s*\(/,
  /\beval\s*\(/,
]);

export const VM_FORBIDDEN_PATTERNS = Object.freeze([
  /\bcompileMoveStack\b/,
  /\bcompileAppendStacks\b/,
  /\bapplyComposition\b/,
  /\bimport\s*\(/,
]);

export const REEXPORT_BYPASS_PATTERNS = Object.freeze([
  /export\s+\{[^}]*\}\s+from\s+['"]\.\/graph_operations\.js['"]/,
  /export\s+\*\s+from\s+['"]\.\/graph_operations\.js['"]/,
  /export\s+\{[^}]*applyOperation[^}]*\}\s+from\s+['"][^'"]+['"]/,
  /export\s+\{[^}]*compile[A-Z][^}]*\}\s+from\s+['"]\.\/graph_operation_client/,
]);

export const ALIAS_LEAKAGE_PATTERNS = Object.freeze([
  /import\s+\{[^}]*\bapplyOperation\s+as\s+\w+/,
  /import\s+\{[^}]*\bcompile[A-Z]\w*\s+as\s+\w+/,
  /const\s+\w+\s*=\s*applyOperation\b/,
  /const\s+\w+\s*=\s*require\s*\(/,
]);

const PAYLOAD_RULES = Object.freeze({
  AddNode: (p) => typeof p === 'object' && p !== null
    && (typeof p.nodeId === 'string' || p.type != null || p.blockType != null),
  RemoveNode: (p) => typeof p?.nodeId === 'string' && p.nodeId.length > 0,
  MoveNode: (p) => typeof p?.nodeId === 'string'
    && typeof p?.position === 'object'
    && Number.isFinite(Number(p.position.x))
    && Number.isFinite(Number(p.position.y)),
  AddEdge: (p) => typeof p?.source === 'string' && typeof p?.target === 'string',
  RemoveEdge: (p) => typeof p?.edgeId === 'string' && p.edgeId.length > 0,
  UpdateNodeData: (p) => typeof p?.nodeId === 'string' && p.nodeId.length > 0,
  UpdateEdge: (p) => typeof p?.edgeId === 'string' && p.edgeId.length > 0,
  UpdateViewport: (p) => typeof p === 'object' && p !== null,
  GroupSelection: (p) => Array.isArray(p?.nodeIds) || p?.groupId != null || p?.remove === true,
});

const STRICT_PAYLOAD_RULES = Object.freeze({
  AddNode: (p) => PAYLOAD_RULES.AddNode(p)
    && typeof p.nodeId === 'string'
    && p.nodeId.length > 0
    && typeof p.type === 'string',
  RemoveNode: (p) => PAYLOAD_RULES.RemoveNode(p),
  MoveNode: (p) => PAYLOAD_RULES.MoveNode(p)
    && typeof p.position.x === 'number'
    && typeof p.position.y === 'number',
  AddEdge: (p) => PAYLOAD_RULES.AddEdge(p)
    && p.source.length > 0
    && p.target.length > 0
    && p.source !== p.target,
  RemoveEdge: (p) => PAYLOAD_RULES.RemoveEdge(p),
  UpdateNodeData: (p) => PAYLOAD_RULES.UpdateNodeData(p)
    && (p.data != null || p.patch != null || p.meta != null),
  UpdateEdge: (p) => PAYLOAD_RULES.UpdateEdge(p),
  UpdateViewport: (p) => PAYLOAD_RULES.UpdateViewport(p)
    && Number.isFinite(Number(p.x))
    && Number.isFinite(Number(p.y))
    && Number.isFinite(Number(p.zoom)),
  GroupSelection: (p) => PAYLOAD_RULES.GroupSelection(p),
});

function activePayloadRules() {
  return STRICT_VM_SEMANTICS_MODE ? STRICT_PAYLOAD_RULES : PAYLOAD_RULES;
}

function rejectUnknownPayloadKeys(type, payload) {
  if (!STRICT_VM_SEMANTICS_MODE || !payload || typeof payload !== 'object') {
    return null;
  }
  const allowed = {
    AddNode: new Set(['nodeId', 'type', 'blockType', 'position', 'data', 'props', 'meta', 'restoreEdges']),
    RemoveNode: new Set(['nodeId']),
    MoveNode: new Set(['nodeId', 'position']),
    AddEdge: new Set(['edgeId', 'source', 'target', 'sourceNodeId', 'targetNodeId', 'sourcePort', 'targetPort', 'label', 'condition']),
    RemoveEdge: new Set(['edgeId']),
    UpdateNodeData: new Set(['nodeId', 'data', 'patch', 'meta']),
    UpdateEdge: new Set(['edgeId', 'condition', 'label', 'sourcePort', 'targetPort']),
    UpdateViewport: new Set(['x', 'y', 'zoom']),
    GroupSelection: new Set(['groupId', 'nodeIds', 'label', 'remove', 'restore']),
  };
  const keys = allowed[type];
  if (!keys) return null;
  for (const key of Object.keys(payload)) {
    if (!keys.has(key)) {
      return { ok: false, error: `Strict mode: unknown payload key "${key}" on ${type}` };
    }
  }
  return null;
}

/**
 * Validate a single canonical operation spec against VM payload rules.
 */
export function validateCompositionOperationPayload(type, payload) {
  const canonical = normalizeOperationType(type);
  if (!GRAPH_OPERATION_TYPES.includes(canonical)) {
    return { ok: false, error: `Operation type not in GRAPH_OPERATION_TYPES: ${type}` };
  }
  const keyCheck = rejectUnknownPayloadKeys(canonical, payload);
  if (keyCheck) return keyCheck;
  const rule = activePayloadRules()[canonical];
  if (!rule) {
    return { ok: false, error: `No VM payload rule for operation: ${canonical}` };
  }
  if (!rule(payload || {})) {
    return { ok: false, error: `Invalid VM payload for ${canonical}` };
  }
  return { ok: true, type: canonical };
}

/**
 * @param {ReadonlyArray<{ type: string, payload?: object }>} operations
 */
export function validateCompositionOperations(operations) {
  if (!Array.isArray(operations)) {
    return { ok: false, error: 'Composition must be an operation array' };
  }
  const normalized = [];
  for (const op of operations) {
    if (!op || typeof op !== 'object' || typeof op.type !== 'string') {
      return { ok: false, error: 'Each operation must be { type, payload }' };
    }
    const canonical = normalizeOperationType(op.type);
    if (!GRAPH_OPERATION_TYPES.includes(canonical)) {
      return { ok: false, error: `Non-canonical operation in composition: ${op.type}` };
    }
    const payloadCheck = validateCompositionOperationPayload(canonical, op.payload || {});
    if (!payloadCheck.ok) {
      return payloadCheck;
    }
    normalized.push({ type: canonical, payload: { ...(op.payload || {}) } });
  }
  return { ok: true, operations: normalized };
}

/**
 * @param {{ ok: boolean, operations?: ReadonlyArray, error?: string }} compiled
 */
export function validateCompiledComposition(compiled) {
  if (!compiled || typeof compiled !== 'object') {
    return { ok: false, error: 'Compiled composition must be an object' };
  }
  if (!compiled.ok) {
    return { ok: false, error: compiled.error || 'Composition compile failed' };
  }
  return validateCompositionOperations(compiled.operations || []);
}

/** Strict gate for single-op runtime dispatch (primitives). */
export function validateStrictDispatch(type, payload = {}) {
  if (!STRICT_VM_SEMANTICS_MODE) {
    return { ok: true, type: normalizeOperationType(type), payload };
  }
  const canonical = normalizeOperationType(type);
  if (!GRAPH_OPERATION_TYPES.includes(canonical)) {
    return { ok: false, error: `Strict mode: forbidden dispatch type ${type}` };
  }
  const payloadCheck = validateCompositionOperationPayload(canonical, payload);
  if (!payloadCheck.ok) return payloadCheck;
  return { ok: true, type: canonical, payload };
}

export function extractModuleImportSpecifiers(source) {
  const specs = [];
  const staticRe = /(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  let m;
  while ((m = staticRe.exec(source)) !== null) {
    specs.push(m[1]);
  }
  const dynamicRe = /import\s*\(\s*['"]([^'"]+)['"]/g;
  while ((m = dynamicRe.exec(source)) !== null) {
    specs.push(m[1]);
  }
  return specs;
}

function moduleMatchesLayer(spec, layerKey) {
  const s = String(spec).replace(/\\/g, '/');
  const file = LAYER_MODULE_FILES[layerKey];
  if (!file) return false;
  return s.endsWith(file) || s.includes(file.replace('.js', ''));
}

function specViolatesForbiddenImports(spec, forbiddenList) {
  const s = String(spec);
  return forbiddenList.some((f) => s.includes(f.replace('./', '')) || s === f || s.endsWith(f));
}

export function scanImportIsolation(source, options = {}) {
  const hits = [];
  const layer = options.layer;
  const filePath = options.filePath || '';
  const specs = extractModuleImportSpecifiers(source);

  const forbiddenByLayer = {
    [COMPILER_LAYER]: COMPILER_FORBIDDEN_IMPORTS,
    [RUNTIME_CLIENT_LAYER]: RUNTIME_CLIENT_FORBIDDEN_IMPORTS,
    [VM_LAYER]: VM_FORBIDDEN_IMPORTS,
  };

  const forbidden = forbiddenByLayer[layer] || [];
  for (const spec of specs) {
    if (specViolatesForbiddenImports(spec, forbidden)) {
      hits.push({
        pattern: spec,
        reason: `Layer ${layer} must not import: ${spec}`,
      });
    }
  }

  if (layer === COMPILER_LAYER) {
    for (const spec of specs) {
      if (moduleMatchesLayer(spec, RUNTIME_CLIENT_LAYER) || moduleMatchesLayer(spec, VM_LAYER)) {
        hits.push({ pattern: spec, reason: `Compiler indirect VM/client import: ${spec}` });
      }
    }
  }

  if (layer === RUNTIME_CLIENT_LAYER) {
    for (const spec of specs) {
      if (moduleMatchesLayer(spec, COMPILER_LAYER)) {
        hits.push({ pattern: spec, reason: `Runtime client must not import compiler: ${spec}` });
      }
    }
  }

  if (layer === VM_LAYER) {
    for (const spec of specs) {
      if (
        moduleMatchesLayer(spec, COMPILER_LAYER)
        || moduleMatchesLayer(spec, RUNTIME_CLIENT_LAYER)
        || moduleMatchesLayer(spec, ORCHESTRATOR_LAYER)
      ) {
        hits.push({ pattern: spec, reason: `VM must not import UI layers: ${spec}` });
      }
    }
  }

  for (const pattern of REEXPORT_BYPASS_PATTERNS) {
    if (pattern.test(source)) {
      hits.push({
        pattern: String(pattern),
        reason: 'Re-export bypass of layer boundary detected',
      });
    }
  }

  if (layer === COMPILER_LAYER || layer === RUNTIME_CLIENT_LAYER) {
    for (const pattern of ALIAS_LEAKAGE_PATTERNS) {
      if (pattern.test(source)) {
        hits.push({
          pattern: String(pattern),
          reason: 'Alias-based semantic leakage (VM/compiler symbol rename)',
        });
      }
    }
  }

  if (filePath.endsWith('graph_ui_compositions.js') && !source.includes('COMPILER_LAYER')) {
    hits.push({ pattern: 'COMPILER_LAYER', reason: 'Compiler module must declare COMPILER_LAYER marker' });
  }

  return hits;
}

export function scanCompilerLayerSource(source, options = {}) {
  const hits = scanImportIsolation(source, {
    ...options,
    layer: COMPILER_LAYER,
  });

  for (const pattern of COMPILER_FORBIDDEN_PATTERNS) {
    if (pattern.test(source)) {
      hits.push({
        pattern: String(pattern),
        reason: 'Compiler layer must not reference runtime dispatch, reflection, or VM execution',
      });
    }
  }

  return hits;
}

export function scanRuntimeClientSource(source, options = {}) {
  const hits = scanImportIsolation(source, {
    ...options,
    layer: RUNTIME_CLIENT_LAYER,
  });

  for (const pattern of RUNTIME_CLIENT_FORBIDDEN_PATTERNS) {
    if (pattern.test(source)) {
      hits.push({
        pattern: String(pattern),
        reason: 'Runtime client must not define compile logic or use reflection',
      });
    }
  }
  if (!source.includes('RUNTIME_CLIENT_LAYER') && source.includes('applyComposition')) {
    hits.push({ pattern: 'RUNTIME_CLIENT_LAYER', reason: 'Runtime client must declare RUNTIME_CLIENT_LAYER marker' });
  }
  if (STRICT_VM_SEMANTICS_MODE && !source.includes('STRICT_VM_SEMANTICS_MODE')) {
    hits.push({ pattern: 'STRICT_VM_SEMANTICS_MODE', reason: 'Runtime client must acknowledge strict semantics mode' });
  }

  return hits;
}

export function scanVmLayerSource(source, options = {}) {
  const hits = scanImportIsolation(source, {
    ...options,
    layer: VM_LAYER,
  });

  for (const pattern of VM_FORBIDDEN_PATTERNS) {
    if (pattern.test(source)) {
      hits.push({
        pattern: String(pattern),
        reason: 'VM layer must not reference compiler/runtime client orchestration',
      });
    }
  }
  if (!source.includes('VM_LAYER') && source.includes('applyOperation')) {
    hits.push({ pattern: 'VM_LAYER', reason: 'VM module must declare VM_LAYER marker' });
  }

  return hits;
}

/**
 * Build dependency edges from graph_document modules and detect forbidden chains.
 */
export function analyzeLayerDependencyGraph(modules) {
  const hits = [];
  const fileToLayer = {};
  for (const [layer, file] of Object.entries(LAYER_MODULE_FILES)) {
    fileToLayer[file] = layer;
  }

  const edges = [];
  for (const { filePath, source } of modules) {
    const normalized = filePath.replace(/\\/g, '/');
    const layer = Object.entries(fileToLayer).find(([f]) => normalized.endsWith(f))?.[1];
    if (!layer) continue;

    for (const spec of extractModuleImportSpecifiers(source)) {
      const targetLayer = Object.entries(fileToLayer).find(([f]) => spec.includes(f.replace('./', '')))?.[1];
      if (targetLayer) {
        edges.push({ from: layer, to: targetLayer, spec, file: normalized });
      }
    }
  }

  const forbidden = FORBIDDEN_LAYER_IMPORTS;
  for (const edge of edges) {
    const blocked = forbidden[edge.from];
    if (blocked && blocked.includes(edge.to)) {
      hits.push({
        pattern: `${edge.from}→${edge.to}`,
        reason: `Forbidden layer dependency via ${edge.spec} in ${edge.file}`,
      });
    }
  }

  const cycles = detectOrchestratorCycles(edges);
  hits.push(...cycles);

  return { hits, edges };
}

function detectOrchestratorCycles(edges) {
  const hits = [];
  const adj = new Map();
  for (const { from, to } of edges) {
    if (!adj.has(from)) adj.set(from, new Set());
    adj.get(from).add(to);
  }
  const visited = new Set();
  const stack = new Set();

  function dfs(node) {
    if (stack.has(node)) {
      hits.push({
        pattern: `cycle:${node}`,
        reason: `Circular semantic dependency involving layer ${node}`,
      });
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    stack.add(node);
    for (const next of adj.get(node) || []) dfs(next);
    stack.delete(node);
  }

  for (const node of adj.keys()) dfs(node);
  return hits;
}
