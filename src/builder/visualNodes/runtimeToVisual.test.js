import { describe, it, expect } from 'vitest';
import { resolveVisualType, RUNTIME_TO_VISUAL } from './runtimeToVisual.js';
import { resolveVisualEditorNode } from './resolveVisualNode.js';

describe('runtimeToVisual', () => {
  it('maps message runtime types', () => {
    expect(resolveVisualType('message')).toBe('message');
    expect(resolveVisualType('photo')).toBe('message');
  });

  it('maps triggers to input', () => {
    expect(resolveVisualType('on_text')).toBe('input');
    expect(resolveVisualType('ask')).toBe('input');
  });

  it('maps goals and sequences', () => {
    expect(resolveVisualType('start')).toBe('goal');
    expect(resolveVisualType('loop')).toBe('sequence');
  });

  it('covers all declared runtime keys with valid visual types', () => {
    for (const rt of Object.keys(RUNTIME_TO_VISUAL)) {
      const v = resolveVisualEditorNode({ runtimeType: rt, props: {}, lang: 'ru' });
      expect(v.visualType).toBeTruthy();
      expect(v.spec).toBeTruthy();
    }
  });
});
