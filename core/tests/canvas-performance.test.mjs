import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeSelectionOnNodes,
  flowNodesNeedUpdate,
} from '../../src/builder/projectionSync.js';
import { zoomToTier, tierAllowsMotion } from '../../src/performance/zoomTier.js';
import { getVisibleFlowBounds, nodeIntersectsBounds } from '../../src/performance/viewportCull.js';
import {
  getIncrementalCompileSnapshot,
  invalidateCompileCache,
  documentRevisionKey,
} from '../../src/performance/incrementalCompile.js';
import { scheduleBatched, flushBatched } from '../../src/performance/batchedUpdates.js';

describe('canvas performance utilities', () => {
  it('selection-only merge avoids full node rebuild', () => {
    const nodes = [
      { id: 'a', selected: false, position: { x: 0, y: 0 } },
      { id: 'b', selected: false, position: { x: 1, y: 1 } },
    ];
    const next = mergeSelectionOnNodes(nodes, 'a');
    assert.equal(next[0].selected, true);
    assert.equal(next[1], nodes[1]);
  });

  it('flowNodesNeedUpdate detects position change', () => {
    const a = [{ id: 'n', position: { x: 0, y: 0 }, data: {} }];
    const b = [{ id: 'n', position: { x: 10, y: 0 }, data: {} }];
    assert.equal(flowNodesNeedUpdate(a, b), true);
  });

  it('zoom tier disables motion at low zoom', () => {
    assert.equal(zoomToTier(0.3), 'minimal');
    assert.equal(tierAllowsMotion('minimal'), false);
  });

  it('viewport cull detects intersection', () => {
    const bounds = { minX: 0, minY: 0, maxX: 500, maxY: 500 };
    assert.equal(
      nodeIntersectsBounds({ position: { x: 100, y: 100 }, width: 200, height: 80 }, bounds),
      true,
    );
    assert.equal(
      nodeIntersectsBounds({ position: { x: 900, y: 900 }, width: 200, height: 80 }, bounds),
      false,
    );
  });

  it('incremental compile cache hits same revision', () => {
    const doc = { metadata: { revision: 7 } };
    invalidateCompileCache();
    let calls = 0;
    const snap = getIncrementalCompileSnapshot(doc, () => {
      calls += 1;
      return { ok: true };
    });
    const snap2 = getIncrementalCompileSnapshot(doc, () => {
      calls += 1;
      return { ok: false };
    });
    assert.equal(snap.ok, true);
    assert.equal(snap2.ok, true);
    assert.equal(calls, 1);
    assert.equal(documentRevisionKey(doc), 7);
  });

  it('batched updates flush runs queued callbacks', () => {
    let count = 0;
    scheduleBatched('test-batch', () => { count += 1; });
    scheduleBatched('test-batch', () => { count += 1; });
    flushBatched('test-batch');
    assert.equal(count, 2);
  });
});
