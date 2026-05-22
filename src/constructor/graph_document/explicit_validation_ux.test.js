import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  VALIDATION_MODE,
  allowsBlockingCompileOverlay,
  validationBadgeLevel,
  validationModeToStage,
} from './validation_modes.js';
import { VALIDATION_STAGE } from './validation_stages.js';
import { shouldShowCompileOverlay } from './validation_stages.js';

describe('explicit validation UX', () => {
  it('soft mode never allows blocking overlay', () => {
    assert.equal(allowsBlockingCompileOverlay(VALIDATION_MODE.SOFT), false);
    assert.equal(
      shouldShowCompileOverlay(VALIDATION_STAGE.COMMITTED, [{ code: 'dangling_edge', severity: 'error' }], {
        allowBlockingOverlay: false,
      }),
      false,
    );
  });

  it('strict mode maps to compile stage', () => {
    assert.equal(validationModeToStage(VALIDATION_MODE.STRICT), VALIDATION_STAGE.COMPILE);
    assert.equal(allowsBlockingCompileOverlay(VALIDATION_MODE.STRICT), true);
  });

  it('full mode uses committed stage with callbacks', () => {
    assert.equal(validationModeToStage(VALIDATION_MODE.FULL), VALIDATION_STAGE.COMMITTED);
  });

  it('validation badge levels', () => {
    assert.equal(validationBadgeLevel({ error: 0, warning: 0 }), 'ok');
    assert.equal(validationBadgeLevel({ error: 0, warning: 2 }), 'warnings');
    assert.equal(validationBadgeLevel({ error: 1, warning: 0 }), 'errors');
  });
});
