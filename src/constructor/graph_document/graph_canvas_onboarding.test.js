import test from 'node:test';
import assert from 'node:assert/strict';
import { createGraphDocument } from './graph_document.js';
import {
  hasUserVisibleCanvasNodes,
  shouldShowCanvasOnboardingOverlay,
  isGraphSettingsOnlyShell,
  pickPrimaryCanvasNodeId,
  isGraphEffectivelyEmpty,
} from './graph_canvas_state.js';
import { projectGraphDocumentToCanvas } from './graph_projection.js';

test('onboarding shown for zero nodes', () => {
  const doc = createGraphDocument({ nodes: {}, edges: {} });
  assert.equal(shouldShowCanvasOnboardingOverlay(doc), true);
  const projection = projectGraphDocumentToCanvas(doc);
  assert.equal(projection.nodes.length, 0);
});

test('onboarding hidden after start node', () => {
  const doc = createGraphDocument({
    nodes: { s: { id: 's', type: 'start', position: { x: 0, y: 0 } } },
    edges: {},
  });
  assert.equal(hasUserVisibleCanvasNodes(doc), true);
  assert.equal(shouldShowCanvasOnboardingOverlay(doc), false);
});

test('onboarding hidden after orphan message (not broken-shell for overlay)', () => {
  const doc = createGraphDocument({
    nodes: { m: { id: 'm', type: 'message', position: { x: 0, y: 0 }, data: { text: 'hi' } } },
    edges: {},
  });
  assert.equal(shouldShowCanvasOnboardingOverlay(doc), false);
  assert.equal(isGraphEffectivelyEmpty(doc), true);
});

test('onboarding hidden after inline keyboard node', () => {
  const doc = createGraphDocument({
    nodes: {
      ikb: { id: 'ikb', type: 'inline_keyboard', position: { x: 0, y: 0 }, data: { rows: [] } },
    },
    edges: {},
  });
  assert.equal(shouldShowCanvasOnboardingOverlay(doc), false);
});

test('onboarding hidden when only settings nodes (version/bot)', () => {
  const doc = createGraphDocument({
    nodes: { b: { id: 'b', type: 'bot', position: { x: 0, y: 0 }, data: {} } },
    edges: {},
  });
  assert.equal(shouldShowCanvasOnboardingOverlay(doc), false);
  assert.equal(isGraphSettingsOnlyShell(doc), true);
});

test('pickPrimaryCanvasNodeId prefers start', () => {
  const doc = createGraphDocument({
    nodes: {
      m: { id: 'm', type: 'message', position: { x: 0, y: 80 }, data: {} },
      s: { id: 's', type: 'start', position: { x: 0, y: 0 } },
    },
    edges: {},
  });
  assert.equal(pickPrimaryCanvasNodeId(doc), 's');
});

test('projection sync — nodes length matches document', () => {
  const doc = createGraphDocument({
    nodes: {
      s: { id: 's', type: 'start', position: { x: 0, y: 0 } },
      m: { id: 'm', type: 'message', position: { x: 0, y: 80 }, data: {} },
    },
    edges: { e: { id: 'e', source: 's', target: 'm' } },
  });
  const projection = projectGraphDocumentToCanvas(doc);
  assert.equal(projection.nodes.length, 2);
  assert.equal(shouldShowCanvasOnboardingOverlay(doc), false);
});
