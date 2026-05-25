import { VISUAL_NODE_SPECS, visualTypeLabel } from './visualNodeTypes.js';
import { resolveVisualType } from './runtimeToVisual.js';
import { buildVisualNodeContent } from './visualNodeContent.js';
import { getNodePortDescriptors } from '../../constructor/graph_document/operation_registry.js';

/**
 * Visual editor node view-model (projection-only, never persisted as node.type).
 * @typedef {object} VisualEditorNode
 * @property {string} runtimeType — GraphDocument node.type (compiler)
 * @property {import('./visualNodeTypes.js').VisualNodeType} visualType
 * @property {import('./visualNodeTypes.js').VisualNodeSpec} spec
 * @property {string} title
 * @property {string} icon
 * @property {import('./visualNodeContent.js').VisualNodeContent} content
 * @property {readonly { id: string, label: string | null }[]} outputPorts
 * @property {{ id: string } | null} inputPort
 * @property {boolean} isChainRoot
 */

/**
 * @param {object} params
 * @param {string} params.runtimeType
 * @param {object} [params.props]
 * @param {object} [params.meta]
 * @param {string} [params.label]
 * @param {string} [params.paletteIcon]
 * @param {string} [params.paletteLabel]
 * @param {string} [params.description]
 * @param {boolean} [params.isChainRoot]
 * @param {string} [params.lang]
 * @returns {VisualEditorNode}
 */
export function resolveVisualEditorNode({
  runtimeType,
  props,
  meta,
  label,
  paletteIcon,
  paletteLabel,
  description,
  isChainRoot = false,
  lang = 'ru',
}) {
  const visualType = resolveVisualType(runtimeType);
  const spec = VISUAL_NODE_SPECS[visualType] || VISUAL_NODE_SPECS.action;
  const content = buildVisualNodeContent({
    runtimeType,
    props,
    meta,
    paletteLabel,
    description,
    isChainRoot,
    lang,
  });

  const portDesc = getNodePortDescriptors(runtimeType);
  const outputs = (portDesc.outputs || []).map((p) => ({
    id: p.id || 'flow',
    label: p.edgeLabel || p.label || null,
    kind: p.kind || 'flow',
  }));
  const input = (portDesc.inputs || [])[0];

  return {
    runtimeType,
    visualType,
    spec,
    title: label || paletteLabel || visualTypeLabel(visualType, lang),
    icon: paletteIcon || spec.icon,
    content,
    outputPorts: outputs,
    inputPort: input ? { id: input.id || 'flow' } : null,
    isChainRoot,
  };
}

/**
 * Re-export for projection / minimap.
 * @param {string} runtimeType
 */
export { resolveVisualType };
