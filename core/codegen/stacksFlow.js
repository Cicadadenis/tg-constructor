/**
 * Editor stacks[] → React Flow graph for codegen pipeline.
 */

function trimStr(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function flowNodeIdForStackBlock(stack, block, index) {
  const blockId = String(block?.id || `b${index}`).trim();
  const stackId = String(stack?.id || '').trim();
  if (!stackId || stackId === 'undefined') return blockId;
  if (blockId.startsWith('n_')) return blockId;
  if (blockId.startsWith(`${stackId}_`)) return blockId;
  return `n_${stackId}_${blockId}`;
}

function flowNodeDataForBlock(block, compilerId) {
  return {
    type: block.type,
    props: { ...(block.props || {}) },
    uiAttachments: block.uiAttachments,
    semanticId: block.id,
    irId: compilerId,
    compilerId,
  };
}

export function stacksToFlow(stacks) {
  const nodes = [];
  const edges = [];
  for (const stack of stacks || []) {
    let prev = null;
    let yOff = 0;
    const blocks = stack?.blocks || [];
    for (const [index, b] of blocks.entries()) {
      const id = flowNodeIdForStackBlock(stack, b, index);
      let block = b;
      if (b?.type === 'callback' && blocks[index + 1] && !trimStr(b?.props?.gotoRef)) {
        const nextId = flowNodeIdForStackBlock(stack, blocks[index + 1], index + 1);
        block = {
          ...b,
          props: { ...(b.props || {}), gotoRef: nextId },
        };
      }
      nodes.push({
        id,
        type: 'cicada',
        position: { x: stack.x || 0, y: (stack.y || 0) + yOff },
        data: flowNodeDataForBlock(block, id),
      });
      yOff += 112;
      if (prev) {
        edges.push({
          id: `e_${prev}_${id}`,
          source: prev,
          target: id,
          sourceHandle: 'flow',
          targetHandle: 'flow',
        });
      }
      prev = id;
    }
  }
  return { nodes, edges };
}
