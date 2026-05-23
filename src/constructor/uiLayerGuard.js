/**
 * UI layer import guard — Builder must not import execution runtime.
 *
 * @param {string} importPath - module specifier being imported
 * @returns {{ allowed: boolean, reason?: string }}
 */
const FORBIDDEN_PREFIXES = [
  'cicada_platform/runtime',
  'cicada_platform.runtime',
  '/runtime/control_plane',
  '/runtime/native_core',
  '/runtime/ops',
  'NativeOp',
  'GraphControlPlane',
  'GraphExecutionEngine',
  'native_core',
];

const ALLOWED_PREFIXES = [
  '/constructor/',
  'constructor/',
  'cicada_platform/constructor',
  '/core/ir/',
  'core/ir/',
  '/core/graph/',
  'core/graph/',
];

import {
  scanSourceForForbiddenGraphMutations,
  assertNoDirectGraphMutation,
  assertNoCanvasOwnedGraphState,
} from './graph_document/graph_mutation_guard.js';
import { scanSourceForHiddenCompositionDSL } from './graph_document/graph_composition_guard.js';

export {
  scanSourceForForbiddenGraphMutations,
  assertNoDirectGraphMutation,
  assertNoCanvasOwnedGraphState,
  scanSourceForHiddenCompositionDSL,
};

const FORBIDDEN_PALETTE_IMPORT_MARKERS = [
  'block_registry',
  'blockRegistry',
  'dsl_blocks',
  'block_palette',
  '/core/blockRegistry',
  'getPaletteBlockTypes',
];

const FORBIDDEN_PALETTE_SOURCE_PATTERNS = [
  /\bgetPaletteBlockTypes\s*\(/,
  /\bfrom\s+['"][^'"]*block_registry[^'"]*['"]/,
  /\bfrom\s+['"][^'"]*dsl_blocks[^'"]*['"]/,
  /\bfrom\s+['"][^'"]*block_palette[^'"]*['"]/,
];

function extractFunctionSource(source, name) {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  if (start < 0) return '';
  const nextFn = source.indexOf('\nfunction ', start + marker.length);
  const end = nextFn > start ? nextFn : source.length;
  return source.slice(start, end);
}

/** Scan UI sources for legacy palette / block-registry usage. */
export function scanSourceForLegacyPaletteSources(source, options = {}) {
  const hits = [];
  const filePath = String(options.filePath || '');
  const sidebarBody = extractFunctionSource(source, 'Sidebar');
  const isSidebarFile = Boolean(sidebarBody)
    || /function\s+Sidebar\b/.test(filePath);
  const paletteScanSource = sidebarBody || source;

  const re = /from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const spec = m[1] || m[2];
    if (FORBIDDEN_PALETTE_IMPORT_MARKERS.some((bad) => spec.includes(bad))) {
      hits.push({
        spec,
        reason: `Forbidden legacy palette import: ${spec}`,
      });
    }
  }

  for (const pattern of FORBIDDEN_PALETTE_SOURCE_PATTERNS) {
    if (pattern.test(source)) {
      hits.push({
        spec: pattern.source,
        reason: 'Forbidden legacy block palette API (use graph_ui_palette.js)',
      });
    }
  }

  if (isSidebarFile && /\bBLOCK_TYPES\b/.test(paletteScanSource)) {
    hits.push({
      spec: 'BLOCK_TYPES',
      reason: 'Sidebar must not use BLOCK_TYPES; use buildGraphUiPalette from graph_ui_palette.js',
    });
  }

  if (isSidebarFile && /\blocalizeBlockTypes\s*\(\s*BLOCK_TYPES/.test(paletteScanSource)) {
    hits.push({
      spec: 'localizeBlockTypes(BLOCK_TYPES',
      reason: 'Sidebar must not localize legacy BLOCK_TYPES as palette',
    });
  }

  return hits;
}

export function checkUiImport(importPath) {
  const p = String(importPath ?? '');
  if (ALLOWED_PREFIXES.some((a) => p.includes(a))) {
    return { allowed: true };
  }
  for (const bad of FORBIDDEN_PREFIXES) {
    if (p.includes(bad)) {
      return {
        allowed: false,
        reason: `UI layer cannot import execution module: ${p}`,
      };
    }
  }
  return { allowed: true };
}

export function assertUiImportAllowed(importPath) {
  const r = checkUiImport(importPath);
  if (!r.allowed) {
    throw new Error(r.reason);
  }
}

/** Scan source text for obvious forbidden imports (CI guard). */
export function findForbiddenImportsInSource(source, options = {}) {
  const hits = [];
  const re = /from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]|import\([^'"]*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const spec = m[1] || m[2] || m[3];
    const check = checkUiImport(spec);
    if (!check.allowed) {
      hits.push({ spec, reason: check.reason });
    }
  }
  for (const hit of scanSourceForForbiddenGraphMutations(source)) {
    hits.push({ spec: hit.pattern, reason: hit.reason });
  }
  for (const hit of scanSourceForHiddenCompositionDSL(source)) {
    hits.push({ spec: hit.pattern, reason: hit.reason });
  }
  for (const hit of scanSourceForLegacyPaletteSources(source, options)) {
    hits.push({ spec: hit.spec, reason: hit.reason });
  }
  return hits;
}
