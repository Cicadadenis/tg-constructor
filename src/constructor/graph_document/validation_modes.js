/**
 * Explicit validation UX — soft (edit) / full (check button) / strict (compile & run).
 */

import { VALIDATION_STAGE } from './graph_edit_session.js';

export const VALIDATION_MODE = Object.freeze({
  /** Realtime lightweight checks — non-blocking, no overlay */
  SOFT: 'soft',
  /** Full pipeline — user-initiated «Проверить» */
  FULL: 'full',
  /** Compile / sandbox / server run — blocking gate */
  STRICT: 'strict',
});

/**
 * @param {import('./validation_modes.js').VALIDATION_MODE[keyof typeof VALIDATION_MODE]} mode
 * @param {import('./graph_edit_session.js').VALIDATION_STAGE[keyof typeof VALIDATION_STAGE]} [sessionStage]
 */
export function validationModeToStage(mode, sessionStage = VALIDATION_STAGE.COMMITTED) {
  if (mode === VALIDATION_MODE.STRICT) return VALIDATION_STAGE.COMPILE;
  if (mode === VALIDATION_MODE.FULL) return VALIDATION_STAGE.COMMITTED;
  return sessionStage || VALIDATION_STAGE.EDIT;
}

/**
 * @param {import('./validation_modes.js').VALIDATION_MODE[keyof typeof VALIDATION_MODE]} mode
 */
export function allowsBlockingCompileOverlay(mode) {
  return mode === VALIDATION_MODE.STRICT;
}

/**
 * @param {{ error?: number, warning?: number }} counts
 * @returns {'ok'|'warnings'|'errors'}
 */
export function validationBadgeLevel(counts = {}) {
  const errors = Number(counts.error || 0);
  const warnings = Number(counts.warning || 0);
  if (errors > 0) return 'errors';
  if (warnings > 0) return 'warnings';
  return 'ok';
}
