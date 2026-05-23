import fs from 'fs';

const path = 'src/App.jsx';
let s = fs.readFileSync(path, 'utf8');

s = s.replace(
  "import { buildReplaceGraphFromStacks } from './constructor/graph_document/stacks_dispatch_payload.js';",
  `import {
  appendStacks,
  addBlockToStack,
  addNewStack,
  clearGraph,
  mergeStacks,
  moveStack,
  patchNodeData,
  removeNode,
  updateBlockUiAttachments,
} from './constructor/graph_document/graph_operation_client.js';`,
);

s = s.replace(
  `      const loaded = loadPersistedCanvasBlob(raw);
      graph.dispatch('ReplaceGraphDocument', { document: loaded.document });`,
  `      const loaded = loadPersistedCanvasBlob(raw);
      graph.importGraph(loaded.document);`,
);

s = s.replace(
  `graph.dispatch('ReplaceGraphDocument', buildReplaceGraphFromStacks(graph.getGraphDocument(), []));;`,
  'clearGraph(graph);',
);

s = s.replace(
  /graph\.dispatch\('ReplaceGraphDocument', buildReplaceGraphFromStacks\(graph\.getGraphDocument\(\), \(prev\) => \[\.\.\.prev, \.\.\.newStacks\]\)\);;/g,
  'appendStacks(graph, stacks, newStacks);',
);

s = s.replace(
  `  const handleDeleteBlock = useCallback((stackId, blockId) => {
    graph.dispatch('ReplaceGraphDocument', buildReplaceGraphFromStacks(graph.getGraphDocument(), prev => {
      return prev.map(s => {
        if (s.id !== stackId) return s;
        const blocks = s.blocks.filter(b => b.id !== blockId);
        return blocks.length === 0 ? null : { ...s, blocks };
      }).filter(Boolean);
    }));;
    setSelectedBlockId(null);
    setSelectedStackId(null);
  }, []);`,
  `  const handleDeleteBlock = useCallback((stackId, blockId) => {
    removeNode(graph, blockId);
    setSelectedBlockId(null);
    setSelectedStackId(null);
  }, [graph]);`,
);

s = s.replace(
  `  const handlePropChange = useCallback((key, val) => {
    if (!selectedBlockId) return;
    graph.dispatch('ReplaceGraphDocument', buildReplaceGraphFromStacks(graph.getGraphDocument(), prev => prev.map(s => ({
      ...s,
      blocks: s.blocks.map(b =>
        b.id === selectedBlockId ? { ...b, props: { ...b.props, [key]: val } } : b
      ),
    }))));
  }, [selectedBlockId]);`,
  `  const handlePropChange = useCallback((key, val) => {
    if (!selectedBlockId) return;
    patchNodeData(graph, selectedBlockId, { [key]: val });
  }, [selectedBlockId, graph]);`,
);

s = s.replace(
  `  const handleAddFooterAction = useCallback((blockId, kind) => {
    if (!blockId || !BLOCK_FOOTER_ACTION_TYPES[kind]) return;
    graph.dispatch('ReplaceGraphDocument', buildReplaceGraphFromStacks(graph.getGraphDocument(), prev => prev.map(s => ({
      ...s,
      blocks: s.blocks.map(b => (b.id === blockId ? addUiAttachment(b, kind) : b)),
    }))));
    setSelectedBlockId(blockId);
  }, []);`,
  `  const handleAddFooterAction = useCallback((blockId, kind) => {
    if (!blockId || !BLOCK_FOOTER_ACTION_TYPES[kind]) return;
    const node = graph.getGraphDocument().nodes[blockId];
    if (!node) return;
    const block = {
      id: blockId,
      type: node.type,
      props: node.data,
      uiAttachments: node.meta?.uiAttachments,
    };
    const updated = addUiAttachment(block, kind);
    updateBlockUiAttachments(graph, blockId, () => updated.uiAttachments || {});
    setSelectedBlockId(blockId);
  }, [graph]);`,
);

fs.writeFileSync(path, s);
const left = (s.match(/ReplaceGraphDocument|buildReplaceGraphFromStacks/g) || []).length;
console.log('remaining bulk refs:', left);
