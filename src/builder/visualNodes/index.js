/**
 * Visual editor abstraction layer (ManyChat-style UX).
 * Runtime/compiler types live in GraphDocument; this module is projection-only.
 */

export { VISUAL_NODE_SPECS, visualTypeLabel, isVisualNodeType } from './visualNodeTypes.js';
export { RUNTIME_TO_VISUAL, resolveVisualType, hasRuntimeVisualMapping } from './runtimeToVisual.js';
export { resolveVisualEditorNode } from './resolveVisualNode.js';
export { buildVisualNodeContent } from './visualNodeContent.js';
export {
  VISUAL_NODE_CARD_WIDTH,
  NODE_CARD_WIDTH,
  getVisualNodeLayout,
  visualCardBodyHeight,
} from './visualNodeLayout.js';
export { PORT_KIND_THEME, portKindTheme } from './visualPortTheme.js';
export { default as VisualFlowNodeCard } from './VisualFlowNodeCard.jsx';
