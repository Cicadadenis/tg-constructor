/**
 * Legacy DSL module → graph module manifest (IR + validation + repair).
 */

import { createGraphDocument } from '../../constructor/graph_document/graph_document.js';
import { stacksToGraphDocument } from '../../constructor/graph_document/stacks_bridge.js';
import { repairBrokenCallbacksInDocument } from '../../constructor/graph_document/graph_callback_repair.js';
import { migrateUiAttachmentsToKeyboardNodes } from '../../constructor/graph_document/graph_keyboard_nodes.js';
import { runGraphValidationPipeline } from '../../constructor/graph_document/graph_validation_pipeline.js';
import { GRAPH_MODULE_REGISTRY } from '../graph/registry.js';

function uid(prefix = 'n') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function slugCallback(label) {
  const s = String(label || 'btn')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return `callback_${s || 'btn'}`;
}

/**
 * Minimal Cicada DSL → linear stack blocks (best-effort).
 * @param {string} code
 * @param {string} moduleId
 */
export function dslCodeToStacks(code, moduleId = 'legacy') {
  const blocks = [];
  const lines = String(code || '').split('\n');
  let section = 'main';
  let currentCallback = null;

  const push = (type, props = {}) => {
    blocks.push({ id: uid(type), type, props });
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const botM = line.match(/^бот\s+["'](.+?)["']/i);
    if (botM) {
      push('bot', { token: botM[1] });
      continue;
    }

    const globalM = line.match(/^глобально\s+(\w+)\s*=\s*["']?(.+?)["']?\s*$/i);
    if (globalM) {
      push('global', { varname: globalM[1], value: globalM[2] });
      continue;
    }

    const handlerM = line.match(/^при\s+нажатии\s+["'](.+?)["']\s*:/i);
    if (handlerM) {
      section = 'callback';
      currentCallback = handlerM[1];
      push('callback', { label: currentCallback, data: slugCallback(currentCallback) });
      continue;
    }

    if (/^старт\s*:/i.test(line)) {
      section = 'start';
      currentCallback = null;
      push('start', {});
      continue;
    }

    const replyM = line.match(/^ответ\s+["'](.+?)["']/i) || line.match(/^ответ\s+(.+)/i);
    if (replyM) {
      push('message', { text: replyM[1] });
      continue;
    }

    const buttonsM = line.match(/^кнопки\s+["'](.+?)["']/i) || line.match(/^кнопки\s+(.+)/i);
    if (buttonsM) {
      push('buttons', { rows: buttonsM[1] });
      continue;
    }

    const inlineM = line.match(/^inline\s+(.+)/i);
    if (inlineM) {
      push('inline', { buttons: inlineM[1] });
      continue;
    }

    const condM = line.match(/^если\s+(.+)/i) || line.match(/^если\s+не\s+(.+)/i);
    if (condM) {
      const neg = /^если\s+не/i.test(line);
      push(neg ? 'condition_not' : 'condition', { cond: condM[1] });
      continue;
    }

    if (/^стоп\s*$/i.test(line)) {
      push('stop', {});
      continue;
    }

    const getM = line.match(/^получить\s+["'](.+?)["']\s*→\s*(\w+)/i);
    if (getM) {
      push('get', { key: getM[1], varname: getM[2] });
      continue;
    }

    const rememberM = line.match(/^запомни\s+(\w+)\s*=\s*(.+)/i);
    if (rememberM) {
      push('remember', { varname: rememberM[1], value: rememberM[2] });
      continue;
    }

    const saveGlobalM = line.match(/^сохранить_глобально\s+["'](.+?)["']\s*=\s*(.+)/i);
    if (saveGlobalM) {
      push('set_global', { varname: saveGlobalM[1], value: saveGlobalM[2] });
      continue;
    }
  }

  if (!blocks.some((b) => b.type === 'start') && section !== 'callback') {
    blocks.unshift({ id: uid('start'), type: 'start', props: {} });
  }

  return [{
    id: `stack_${moduleId}`,
    x: 120,
    y: 120,
    blocks,
  }];
}

/**
 * @param {{ id: string, name?: string, desc?: string, code?: string, category?: string }} moduleDef
 * @param {Record<string, import('../composition/types.js').GraphModuleManifest>} [registry]
 */
export function migrateLegacyDslModule(moduleDef, registry = GRAPH_MODULE_REGISTRY) {
  const id = String(moduleDef?.id || '').trim();
  if (!id) {
    return { ok: false, error: 'Module id required', manifest: null, document: null };
  }

  if (registry[id]) {
    return {
      ok: true,
      source: 'registry',
      manifest: registry[id],
      document: graphManifestToDocument(registry[id]),
      warnings: ['Модуль уже доступен как Graph — используется graph_module из реестра'],
    };
  }

  const code = String(moduleDef?.code || '').trim();
  if (!code) {
    return { ok: false, error: 'Legacy module has no DSL code', manifest: null, document: null };
  }

  const stacks = dslCodeToStacks(code, id);
  let document = stacksToGraphDocument(stacks);
  const migrated = migrateUiAttachmentsToKeyboardNodes(document);
  document = migrated.document;

  const repaired = repairBrokenCallbacksInDocument(document, { context: 'dsl_migration' });
  document = repaired.document;

  const validation = runGraphValidationPipeline(document, {
    strict: false,
    allowMissingCallbackHandlers: true,
    context: 'dsl_migration',
  });

  const manifest = {
    id,
    version: 1,
    name: moduleDef.name || id,
    category: moduleDef.category || '',
    dependencies: [],
    capabilities: ['migrated_from_dsl'],
    globals: [],
    callbacks: [],
    mergeStrategy: {
      dedupeBot: true,
      dedupeStart: true,
      mergeGlobals: 'reuse',
      mergeMenus: false,
      placement: 'fragment',
    },
    graph: {
      nodes: Object.values(document.nodes).map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
        meta: n.meta,
      })),
      edges: Object.values(document.edges),
    },
    _migratedFromDsl: true,
  };

  return {
    ok: true,
    source: 'dsl_parse',
    manifest,
    document,
    stacks,
    fixes: repaired.fixes || [],
    warnings: validation.diagnostics?.filter((d) => d.severity === 'warning') || [],
    diagnostics: validation.diagnostics || [],
  };
}

function graphManifestToDocument(manifest) {
  const nodes = (manifest.graph?.nodes || []).map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position || { x: 0, y: 0 },
    data: n.data?.props ? n.data.props : (n.data || {}),
    meta: n.meta || {},
  }));
  const edges = manifest.graph?.edges || [];
  return createGraphDocument({
    schema_version: 2,
    nodes,
    edges,
    metadata: { name: `module-${manifest.id}`, revision: 0 },
  });
}

/**
 * Persist-ready graph_module.json shape.
 */
export function manifestToGraphModuleJson(manifest) {
  return {
    schema_version: 2,
    id: manifest.id,
    version: manifest.version || 1,
    name: manifest.name,
    category: manifest.category,
    dependencies: manifest.dependencies || [],
    graph: manifest.graph,
    mergeStrategy: manifest.mergeStrategy,
    migratedFromDsl: Boolean(manifest._migratedFromDsl),
  };
}
