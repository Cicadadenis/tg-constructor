/**
 * Conflict resolution strategies for module composition merge.
 */

/**
 * @typedef {'reuse'|'rename'|'namespace'|'override'} GlobalConflictResolution
 */

/**
 * @param {object[]} conflicts
 * @param {Record<string, GlobalConflictResolution>} [choices] — key: global name or conflict code
 */
export function applyGlobalConflictResolutions(baseDocument, incomingManifest, conflicts, choices = {}) {
  const resolutions = [];
  const strategyOverrides = { ...(incomingManifest.mergeStrategy || {}) };

  for (const c of conflicts || []) {
    if (c.kind !== 'global' && c.code !== 'global_value_conflict') continue;
    const name = c.existing?.split?.(':')?.[0] || c.message?.match(/"([^"]+)"/)?.[1];
    if (!name) continue;
    const choice = choices[name] || choices.global || 'reuse';
    resolutions.push({ name, choice, conflict: c });

    if (choice === 'override') {
      strategyOverrides.mergeGlobals = 'merge';
    } else if (choice === 'namespace') {
      strategyOverrides.mergeGlobals = 'namespace';
    } else if (choice === 'rename') {
      strategyOverrides.mergeGlobals = 'rename';
    } else {
      strategyOverrides.mergeGlobals = 'reuse';
    }
  }

  return {
    manifest: {
      ...incomingManifest,
      mergeStrategy: strategyOverrides,
    },
    resolutions,
  };
}

/**
 * Human labels for resolution UI.
 */
export const CONFLICT_RESOLUTION_OPTIONS = Object.freeze([
  { id: 'reuse', labelRu: 'Использовать существующий', labelEn: 'Use existing' },
  { id: 'rename', labelRu: 'Переименовать', labelEn: 'Rename incoming' },
  { id: 'namespace', labelRu: 'Namespace модуля', labelEn: 'Namespace module' },
  { id: 'override', labelRu: 'Заменить', labelEn: 'Override' },
]);
