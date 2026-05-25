import { describe, it, expect } from 'vitest';
import { estimateHandleCenter, findNearestCompatibleTarget } from './snapToHandles.js';

describe('snapToHandles', () => {
  it('estimateHandleCenter places target at top of node', () => {
    const center = estimateHandleCenter(
      { id: 'a', position: { x: 100, y: 200 }, data: { canvasBlockType: 'message' } },
      'target',
      'flow',
    );
    expect(center.x).toBeGreaterThan(100);
    expect(center.y).toBe(200 + 8);
  });

  it('findNearestCompatibleTarget returns closest valid port', () => {
    const doc = {
      nodes: {
        src: { id: 'src', type: 'message', data: {} },
        tgt: { id: 'tgt', type: 'message', data: {} },
      },
      edges: {},
    };
    const rfNodes = [
      { id: 'tgt', position: { x: 100, y: 300 }, data: { canvasBlockType: 'message' } },
    ];
    const hit = findNearestCompatibleTarget(
      doc,
      rfNodes,
      { x: 230, y: 308 },
      'src',
      'flow',
      80,
    );
    expect(hit?.nodeId).toBe('tgt');
    expect(hit?.handleId).toBeTruthy();
  });
});
