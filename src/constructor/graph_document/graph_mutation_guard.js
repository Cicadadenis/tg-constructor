/**
 * UI guards — forbid direct graph mutation and canvas-owned authoritative state.
 */

export const FORBIDDEN_MUTATION_PATTERNS = [
  /\bsetNodes\s*[\(\[]/,
  /\bsetEdges\s*[\(\[]/,
  /\buseNodesState\b/,
  /\buseEdgesState\b/,
  /,\s*setNodes\b/,
  /,\s*setEdges\b/,
  /\bmutateStacks\b/,
  /\breplaceStacks\b/,
  /\.replaceDocument\s*\(/,
  /\bstore\.replaceDocument\b/,
  /\bstore\.replay\s*\(/,
  /\bgraph\.importStacks\b/,
  /\bgraph\.importGraph\b/,
  /\bimportStacksIntoStore\b/,
  /\bimportGraphDocumentIntoStore\b/,
  /['"]ReplaceGraphDocument['"]/,
];

const FORBIDDEN_DIRECT_DOCUMENT_MUTATION = /\b(getGraphDocument|\.document)\s*\(\s*\)[\s\S]{0,80}?\.(nodes|edges)\s*\[[^\]]+\]\s*=/;

const AUTHORITATIVE_STATE_KEYS = new Set([
  'authoritativeNodes',
  'authoritativeEdges',
  'ownedGraph',
  'mutableGraph',
]);

export function scanSourceForForbiddenGraphMutations(source) {
  const hits = [];
  for (const pattern of FORBIDDEN_MUTATION_PATTERNS) {
    if (pattern.test(source)) {
      hits.push({
        pattern: String(pattern),
        reason: 'Direct canvas graph mutation is forbidden; use GraphEditorStore.dispatch',
      });
    }
  }
  if (FORBIDDEN_DIRECT_DOCUMENT_MUTATION.test(source)) {
    hits.push({
      pattern: String(FORBIDDEN_DIRECT_DOCUMENT_MUTATION),
      reason: 'Direct GraphDocument mutation is forbidden; use GraphEditorStore.dispatch',
    });
  }
  return hits;
}

export function assertNoDirectGraphMutation(source, context = 'constructor UI') {
  const hits = scanSourceForForbiddenGraphMutations(source);
  if (hits.length) {
    throw new Error(
      `${context}: direct graph mutation detected (${hits.length} hit(s)). Dispatch GraphDocument operations only.`,
    );
  }
}

/**
 * Reject component state that stores authoritative graph without GraphDocument binding.
 */
export function assertNoCanvasOwnedGraphState(state, options = {}) {
  if (!state || typeof state !== 'object') return;
  for (const key of Object.keys(state)) {
    if (AUTHORITATIVE_STATE_KEYS.has(key)) {
      throw new Error(
        `Canvas-owned graph state forbidden: state.${key}. Use GraphDocument + projection.`,
      );
    }
  }
  if (
    options.strict
    && Array.isArray(state.nodes)
    && Array.isArray(state.edges)
    && !state.__fromGraphProjection
  ) {
    throw new Error(
      'Canvas state contains nodes/edges without graph projection marker. Project from GraphDocument only.',
    );
  }
}

/**
 * Tag projection output so guards can distinguish authoritative vs projected state.
 */
export function markCanvasProjection(projection) {
  return {
    ...projection,
    __fromGraphProjection: true,
  };
}
