import fs from 'fs';

const path = 'src/App.jsx';
let s = fs.readFileSync(path, 'utf8');

if (!s.includes('buildReplaceGraphFromStacks')) {
  s = s.replace(
    "import { useGraphEditor } from './constructor/graph_document/useGraphEditor.js';",
    "import { useGraphEditor } from './constructor/graph_document/useGraphEditor.js';\nimport { buildReplaceGraphFromStacks } from './constructor/graph_document/stacks_dispatch_payload.js';",
  );
}

function replaceCalls(src, method) {
  const needle = `graph.${method}(`;
  const prefix = "graph.dispatch('ReplaceGraphDocument', buildReplaceGraphFromStacks(graph.getGraphDocument(), ";
  let out = '';
  let i = 0;
  while (i < src.length) {
    const idx = src.indexOf(needle, i);
    if (idx === -1) {
      out += src.slice(i);
      break;
    }
    out += src.slice(i, idx);
    let j = idx + needle.length;
    let depth = 1;
    while (j < src.length && depth > 0) {
      const ch = src[j];
      if (ch === '(') depth += 1;
      else if (ch === ')') depth -= 1;
      j += 1;
    }
    const arg = src.slice(idx + needle.length, j - 1);
    out += `${prefix}${arg}));`;
    i = j;
  }
  return out;
}

s = replaceCalls(s, 'mutateStacks');
s = replaceCalls(s, 'replaceStacks');

s = s.replace(
  'const loaded = graph.loadPersisted(raw);',
  "const loaded = loadPersistedCanvasBlob(raw);\n      graph.dispatch('ReplaceGraphDocument', { document: loaded.document });",
);

fs.writeFileSync(path, s);
console.log('mutateStacks:', (s.match(/mutateStacks/g) || []).length);
console.log('replaceStacks:', (s.match(/replaceStacks/g) || []).length);
console.log('loadPersisted:', (s.match(/graph\.loadPersisted/g) || []).length);
