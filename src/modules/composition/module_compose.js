/**
 * Module composition orchestrator — composeModules entry point.
 */

import { repairBrokenCallbacksInDocument } from '../../constructor/graph_document/graph_callback_repair.js';
import { mergeGraphs } from './graph_merge.js';
import {
  resolveModuleDependencies,
  validateComposedDocument,
  validateModuleCompatibility,
  validateModuleManifest,
} from './module_validation.js';

/**
 * @param {string[]} moduleIds
 * @param {Record<string, import('./types.js').GraphModuleManifest>} registry
 * @param {object} [options]
 * @param {import('../../constructor/graph_document/graph_document.js').GraphDocument|null} [options.baseDocument]
 * @param {boolean} [options.autoRepair]
 * @param {boolean} [options.strict]
 * @param {boolean} [options.dryRun]
 */
export function composeModules(moduleIds, registry, options = {}) {
  const report = {
    moduleIds: [...moduleIds],
    resolvedDependencies: [],
    conflicts: [],
    fixes: [],
    diagnostics: [],
    ok: false,
  };

  if (!moduleIds?.length) {
    return { ok: false, document: null, report, error: 'No modules selected' };
  }

  const { resolved, missing } = resolveModuleDependencies(moduleIds, registry);
  report.resolvedDependencies = resolved;
  if (missing.length) {
    for (const m of missing) {
      report.conflicts.push({
        kind: 'dependency',
        code: m.code,
        message: m.message,
        moduleId: m.id,
      });
    }
    return { ok: false, document: null, report, error: missing[0].message };
  }

  const manifests = [];
  for (const id of resolved) {
    const manifest = registry[id];
    const valid = validateModuleManifest(manifest);
    if (!valid.ok) {
      report.conflicts.push(...valid.issues.map((i) => ({
        kind: 'manifest',
        code: i.code,
        message: i.message,
        moduleId: id,
      })));
      return { ok: false, document: null, report, error: valid.issues[0].message };
    }
    manifests.push(manifest);
  }

  const compat = validateModuleCompatibility(manifests);
  if (!compat.ok) {
    report.conflicts.push(...compat.issues.map((i) => ({
      kind: 'compatibility',
      code: i.code,
      message: i.message,
      moduleId: i.moduleId,
    })));
  }

  const merged = mergeGraphs(options.baseDocument || null, manifests);
  report.conflicts.push(...merged.conflicts);
  report.fixes.push(...merged.fixes);

  let document = merged.document;

  if (options.autoRepair !== false) {
    const repaired = repairBrokenCallbacksInDocument(document, { context: 'module_compose' });
    if (repaired.modified) {
      document = repaired.document;
      report.fixes.push(...(repaired.fixes || []).map((f) => ({
        kind: 'callback_repair',
        message: f.message || f.kind || 'callback repair',
        ...f,
      })));
    }
  }

  const validation = validateComposedDocument(document, { strict: options.strict === true });
  report.diagnostics = validation.diagnostics || [];

  if (!validation.ok && options.strict === true) {
    const blocking = validation.diagnostics?.filter((d) => d.severity === 'error') || [];
    return {
      ok: false,
      document: options.dryRun ? document : null,
      report: {
        ...report,
        ok: false,
      },
      error: blocking[0]?.message || 'Composed graph failed validation',
      preview: options.dryRun ? document : null,
    };
  }

  report.ok = true;
  return {
    ok: true,
    document: options.dryRun ? null : document,
    preview: options.dryRun ? document : null,
    report,
  };
}

/**
 * Preview merge without committing (returns document in preview field).
 */
export function previewComposeModules(moduleIds, registry, options = {}) {
  return composeModules(moduleIds, registry, {
    ...options,
    dryRun: true,
  });
}

/**
 * Dedupe handler nodes by callback route key (post-merge cleanup report).
 * @param {import('../../constructor/graph_document/graph_document.js').GraphDocument} document
 */
export function dedupeHandlersReport(document) {
  const byCallback = new Map();
  for (const node of Object.values(document?.nodes || {})) {
    if (node.type !== 'callback') continue;
    const key = String(node.data?.data || node.data?.callbackPrefix || node.id);
    const list = byCallback.get(key) || [];
    list.push(node.id);
    byCallback.set(key, list);
  }
  const duplicates = [];
  for (const [key, ids] of byCallback) {
    if (ids.length > 1) {
      duplicates.push({ callback: key, nodeIds: ids });
    }
  }
  return duplicates;
}

export { mergeGraphs, mergeGraphFragment } from './graph_merge.js';
export { namespaceModuleCallbacks, scopeCallback, detectCallbackCollisions } from './callback_namespace.js';
export { mergeGlobals, buildGlobalsRegistry } from './globals_merge.js';
export { resolveModuleDependencies, validateComposedDocument } from './module_validation.js';
