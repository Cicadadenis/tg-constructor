import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { resetGraphStoreForTests } from '../../src/stores/graphStore.js';
import { useGraphStore } from '../../src/stores/graphStore.js';
import { useSelectionStore } from '../../src/stores/selectionStore.js';
import { useHistoryStore } from '../../src/stores/historyStore.js';
import { useFlowStore } from '../../src/stores/flowStore.js';
import { useUiStore } from '../../src/stores/uiStore.js';

describe('modular zustand stores', () => {
  beforeEach(() => {
    resetGraphStoreForTests({});
    useSelectionStore.setState({
      selectedBlockId: null,
      mobileAttentionBlockId: null,
      draggingPaletteEntry: null,
      repairHighlight: { nodeIds: [], edgeIds: [], until: 0, kind: null },
    });
    useHistoryStore.getState().clearSnapshots();
    useFlowStore.setState({ activeProjectId: null, projectName: '' });
    useUiStore.getState().resetUi();
  });

  it('graph dispatch bumps revision', () => {
    const before = useGraphStore.getState().revision;
    const r = useGraphStore.getState().dispatch('PatchMetadata', { patch: { title: 't' } });
    assert.equal(r.ok, true);
    assert.ok(useGraphStore.getState().revision >= before);
  });

  it('undo/redo via graph store', () => {
    useGraphStore.getState().dispatch('PatchMetadata', { patch: { a: 1 } });
    useGraphStore.getState().dispatch('PatchMetadata', { patch: { b: 2 } });
    assert.equal(useGraphStore.getState().canUndo, true);
    useGraphStore.getState().undo();
    assert.equal(useGraphStore.getState().canRedo, true);
    useGraphStore.getState().redo();
  });

  it('selection store isolates selected node', () => {
    useSelectionStore.getState().selectNode('n1');
    assert.equal(useSelectionStore.getState().selectedBlockId, 'n1');
    useSelectionStore.getState().clearSelection();
    assert.equal(useSelectionStore.getState().selectedBlockId, null);
  });

  it('history time-travel captures and restores', () => {
    useGraphStore.getState().dispatch('PatchMetadata', { patch: { marker: 'x' } });
    const id = useHistoryStore.getState().captureSnapshot('test');
    useGraphStore.getState().dispatch('PatchMetadata', { patch: { marker: 'y' } });
    const doc = useGraphStore.getState().getGraphDocument();
    assert.equal(doc.metadata.marker, 'y');
    const travel = useHistoryStore.getState().travelTo(id);
    assert.equal(travel.ok, true);
    const restored = useGraphStore.getState().getGraphDocument();
    assert.equal(restored.metadata.marker, 'x');
  });

  it('flow store layout mode persists key', () => {
    const mode = useFlowStore.getState().setFlowLayoutMode('COMPACT');
    assert.equal(mode, 'COMPACT');
    assert.equal(useFlowStore.getState().flowLayoutMode, 'COMPACT');
  });
});
