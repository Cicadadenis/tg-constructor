/**
 * Module composition validation — pipeline + dependency checks.
 */

import { runGraphValidationPipeline, strictCompileValidation } from '../../constructor/graph_document/graph_validation_pipeline.js';
import { buildGlobalsRegistry } from './globals_merge.js';
import { buildCallbackRegistry } from './callback_namespace.js';

/**
 * @param {string[]} moduleIds
 * @param {Record<string, import('./types.js').GraphModuleManifest>} registry
 */
export function resolveModuleDependencies(moduleIds, registry) {
  const resolved = [];
  const visiting = new Set();
  const visited = new Set();
  const missing = [];

  function visit(id) {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      missing.push({ id, code: 'dependency_cycle', message: `Circular dependency at ${id}` });
      return;
    }
    const manifest = registry[id];
    if (!manifest) {
      missing.push({
        id,
        code: 'module_not_found',
        message: `Module "${id}" not found`,
        humanMessage: `Модуль «${id}» не найден в реестре graph-модулей`,
      });
      return;
    }
    visiting.add(id);
    for (const dep of manifest.dependencies || []) {
      if (!registry[dep]) {
        missing.push({
          id: dep,
          code: 'missing_dependency',
          message: `Module "${id}" requires missing dependency "${dep}"`,
          requiredBy: id,
          humanMessage: `Модуль «${manifest.name || id}» требует модуль «${dep}»`,
        });
        continue;
      }
      visit(dep);
    }
    visiting.delete(id);
    visited.add(id);
    resolved.push(id);
  }

  for (const id of moduleIds) visit(id);
  return { resolved, missing };
}

/**
 * @param {import('./types.js').GraphModuleManifest} manifest
 */
export function validateModuleManifest(manifest) {
  const issues = [];
  if (!manifest?.id) issues.push({ code: 'invalid_manifest', message: 'Module id required' });
  if (!manifest?.graph?.nodes?.length) {
    issues.push({ code: 'empty_graph', message: `Module ${manifest?.id} has no graph nodes` });
  }
  for (const dep of manifest?.dependencies || []) {
    if (!dep) issues.push({ code: 'invalid_dependency', message: 'Empty dependency id' });
  }
  return { ok: issues.length === 0, issues };
}

/**
 * @param {import('../../constructor/graph_document/graph_document.js').GraphDocument} document
 * @param {object} [options]
 */
export function validateComposedDocument(document, options = {}) {
  const pipeline = runGraphValidationPipeline(document, {
    strict: options.strict !== false,
    context: 'module_compose',
  });
  const compileGate = strictCompileValidation(document, { context: 'module_compose' });
  const compileDiags = compileGate.compileDiagnostics?.report
    || compileGate.diagnostics
    || [];
  return {
    ok: pipeline.ok && compileGate.ok,
    pipeline,
    compileGate,
    diagnostics: [
      ...(pipeline.diagnostics || []),
      ...(Array.isArray(compileDiags) ? compileDiags : []),
    ],
  };
}

/**
 * @param {import('./types.js').GraphModuleManifest[]} manifests
 */
export function validateModuleCompatibility(manifests) {
  const issues = [];
  const globals = buildGlobalsRegistry({});
  const callbacks = buildCallbackRegistry({});

  for (const manifest of manifests) {
    const check = validateModuleManifest(manifest);
    if (!check.ok) issues.push(...check.issues.map((i) => ({ ...i, moduleId: manifest.id })));

    for (const g of manifest.globals || []) {
      if (globals.has(g)) {
        issues.push({
          code: 'global_declared_twice',
          message: `Global "${g}" declared in multiple modules`,
          moduleId: manifest.id,
        });
      }
      globals.set(g, { moduleId: manifest.id });
    }

    for (const cb of manifest.callbacks || []) {
      if (callbacks.has(cb)) {
        issues.push({
          code: 'callback_declared_twice',
          message: `Callback "${cb}" declared in multiple manifests`,
          moduleId: manifest.id,
        });
      }
      callbacks.set(cb, [manifest.id]);
    }
  }

  return { ok: issues.length === 0, issues };
}
