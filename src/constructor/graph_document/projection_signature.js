/**
 * Canvas projection content signature — invalidates ReactFlow when node preview data changes.
 */

/**
 * @param {object[]} nodes — projected canvas nodes
 * @returns {string}
 */
export function projectionNodesSignature(nodes) {
  if (!nodes?.length) return '';
  return nodes.map((n) => {
    const d = n.data || {};
    const props = d.props || d;
    const meta = d.meta || {};
    const kb = [
      props.rows,
      props.buttons,
      props.text,
      meta.uiAttachments,
    ].map((x) => (typeof x === 'string' ? x : JSON.stringify(x ?? ''))).join('|');
    return `${n.id}:${d.type}:${kb}`;
  }).join('\n');
}
