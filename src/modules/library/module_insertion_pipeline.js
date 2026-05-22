/**
 * Staged module insertion — draft compose → validate → repair → preview → commit.
 * Single entry for Module Library (no raw onInsert(code)).
 */

import { composeModules, previewComposeModules } from '../composition/module_compose.js';
import { resolveModuleDependencies } from '../composition/module_validation.js';
import { repairBrokenCallbacksInDocument } from '../../constructor/graph_document/graph_callback_repair.js';
import { runGraphValidationPipeline } from '../../constructor/graph_document/graph_validation_pipeline.js';
import { moduleDisplayName } from './module_catalog.js';
import { migrateLegacyDslModule } from './migrate_legacy_dsl.js';
import { analyzeGraphTopology } from './topology_preview.js';
import { applyGlobalConflictResolutions } from './conflict_resolution.js';

function humanizeMissingDependency(missing, registry) {
  return missing.map((m) => {
    const depId = m.id;
    const parentMatch = m.message?.match(/Module "([^"]+)"/);
    const parentId = parentMatch?.[1] || depId;
    return {
      ...m,
      parentId,
      dependencyId: depId,
      message: `Модуль «${moduleDisplayName(parentId)}» требует модуль «${moduleDisplayName(depId)}»`,
      suggestedAction: { type: 'add_dependency', moduleId: depId },
    };
  });
}

/**
 * @param {string[]} moduleIds
 * @param {Record<string, import('../composition/types.js').GraphModuleManifest>} registry
 * @param {object} [options]
 * @param {import('../../constructor/graph_document/graph_document.js').GraphDocument|null} [options.baseDocument]
 * @param {Record<string, string>} [options.globalResolutions]
 */
export function runInsertionPreview(moduleIds, registry, options = {}) {
  const report = {
    moduleIds: [...moduleIds],
    stage: 'preview',
    ok: false,
    blockers: [],
    warnings: [],
    conflicts: [],
    fixes: [],
    resolvedDependencies: [],
    missingDependencies: [],
    topology: null,
    document: null,
  };

  if (!moduleIds?.length) {
    report.blockers.push({ message: 'Выберите хотя бы один модуль' });
    return report;
  }

  const { resolved, missing } = resolveModuleDependencies(moduleIds, registry);
  report.resolvedDependencies = resolved;
  if (missing.length) {
    report.missingDependencies = humanizeMissingDependency(missing, registry);
    for (const m of report.missingDependencies) {
      report.blockers.push({
        code: m.code || 'missing_dependency',
        message: m.message,
        suggestedAction: m.suggestedAction,
      });
    }
    return report;
  }

  const preview = previewComposeModules(resolved, registry, {
    strict: false,
    autoRepair: true,
    baseDocument: options.baseDocument || null,
    dryRun: true,
  });

  report.conflicts = preview.report?.conflicts || [];
  report.fixes = preview.report?.fixes || [];
  report.diagnostics = preview.report?.diagnostics || [];

  if (!preview.ok) {
    const err = preview.error || preview.report?.conflicts?.[0]?.message;
    report.blockers.push({
      code: 'compose_failed',
      message: err || 'Не удалось собрать модули в граф',
    });
    if (preview.preview) {
      report.document = preview.preview;
      report.topology = analyzeGraphTopology(preview.preview);
    }
    return report;
  }

  const doc = preview.preview;
  report.document = doc;
  report.topology = analyzeGraphTopology(doc);
  report.ok = true;

  const soft = (preview.report?.diagnostics || []).filter((d) => d.severity === 'warning');
  report.warnings = soft.map((d) => ({
    message: d.message || d.title,
    nodeId: d.nodeId,
  }));

  const globalConflicts = report.conflicts.filter((c) => c.kind === 'global');
  if (globalConflicts.length) {
    for (const c of globalConflicts) {
      report.warnings.push({
        code: 'global_conflict',
        message: c.message,
        resolutionOptions: ['reuse', 'rename', 'namespace', 'override'],
      });
    }
  }

  return report;
}

/**
 * Commit composed graph (strict validation optional).
 */
export function commitInsertion(moduleIds, registry, options = {}) {
  const { resolved, missing } = resolveModuleDependencies(moduleIds, registry);
  if (missing.length) {
    const human = humanizeMissingDependency(missing, registry);
    return {
      ok: false,
      error: human[0]?.message || 'Missing dependencies',
      report: { missingDependencies: human },
    };
  }

  let manifests = resolved.map((id) => registry[id]).filter(Boolean);

  if (options.globalResolutions && manifests.length) {
    manifests = manifests.map((m, i) => {
      if (i === 0) return m;
      const { manifest } = applyGlobalConflictResolutions(
        options.baseDocument,
        m,
        options.lastConflicts || [],
        options.globalResolutions,
      );
      return manifest;
    });
  }

  const composed = composeModules(resolved, registry, {
    strict: options.strict === true,
    autoRepair: options.autoRepair !== false,
    baseDocument: options.baseDocument || null,
  });

  if (!composed.ok || !composed.document) {
    return {
      ok: false,
      error: composed.error || 'Сборка модуля не удалась',
      report: composed.report,
    };
  }

  let document = composed.document;
  const validation = runGraphValidationPipeline(document, {
    strict: options.strict === true,
    allowMissingCallbackHandlers: !options.strict,
    context: 'module_insert',
  });

  if (!validation.ok && options.strict) {
    const blocking = validation.diagnostics?.filter((d) => d.severity === 'error') || [];
    return {
      ok: false,
      error: blocking[0]?.message || 'Граф не прошёл проверку перед вставкой',
      report: composed.report,
      diagnostics: validation.diagnostics,
    };
  }

  return {
    ok: true,
    document,
    report: {
      ...composed.report,
      topology: analyzeGraphTopology(document),
      diagnostics: validation.diagnostics,
    },
    moduleIds: resolved,
  };
}

/**
 * Migrate legacy DSL → graph document ready for importComposedGraph.
 */
export function runLegacyMigration(moduleDef, registry, options = {}) {
  const migrated = migrateLegacyDslModule(moduleDef, registry);
  if (!migrated.ok) {
    return {
      ok: false,
      error: migrated.error || 'Миграция не удалась',
    };
  }

  let document = migrated.document;
  if (options.autoRepair !== false) {
    const repaired = repairBrokenCallbacksInDocument(document, { context: 'legacy_migration' });
    document = repaired.document;
    migrated.fixes = [...(migrated.fixes || []), ...(repaired.fixes || [])];
  }

  return {
    ok: true,
    document,
    manifest: migrated.manifest,
    source: migrated.source,
    topology: analyzeGraphTopology(document),
    warnings: migrated.warnings || [],
    fixes: migrated.fixes || [],
  };
}

/**
 * Add missing dependency ids to selection and re-preview.
 */
export function withAutoDependencies(moduleIds, registry) {
  const { resolved, missing } = resolveModuleDependencies(moduleIds, registry);
  const extra = missing.map((m) => m.id).filter((id) => !resolved.includes(id));
  return [...new Set([...moduleIds, ...resolved, ...extra])];
}
