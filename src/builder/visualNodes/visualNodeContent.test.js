import { describe, it, expect } from 'vitest';
import { buildVisualNodeContent } from './visualNodeContent.js';
import { VISUAL_NODE_SPECS } from './visualNodeTypes.js';

describe('buildVisualNodeContent', () => {
  it('builds message preview from text', () => {
    const c = buildVisualNodeContent({
      runtimeType: 'message',
      props: { text: 'Привет!' },
    });
    expect(c.previewBody).toContain('Привет');
    expect(c.inlineEdit?.field).toBe('text');
  });

  it('exposes analytics badge when meta has count', () => {
    const c = buildVisualNodeContent({
      runtimeType: 'message',
      props: {},
      meta: { sentCount: 42 },
    });
    expect(c.analyticsBadge).toBe('42');
  });

  it('maps condition status for marketer UX', () => {
    const c = buildVisualNodeContent({
      runtimeType: 'condition',
      props: { cond: 'user.age > 18' },
    });
    expect(c.status).toBe('Да / Нет');
    expect(c.inlineEdit?.field).toBe('cond');
  });
});

describe('VISUAL_NODE_SPECS', () => {
  it('defines all 11 visual node types', () => {
    const ids = Object.keys(VISUAL_NODE_SPECS);
    expect(ids).toHaveLength(11);
    expect(ids).toContain('message');
    expect(ids).toContain('api_request');
    expect(ids).toContain('sequence');
  });
});
