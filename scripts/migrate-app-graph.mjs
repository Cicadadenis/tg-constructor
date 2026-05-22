import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appPath = path.join(__dirname, '../src/App.jsx');
let s = fs.readFileSync(appPath, 'utf8');

if (!s.includes('useGraphEditorStore')) {
  s = s.replace(
    "import { BlockInfoContext, AddBlockContext, BuilderUiContext } from './builderContext.js';",
    `import { BlockInfoContext, AddBlockContext, BuilderUiContext } from './builderContext.js';
import { useGraphEditorStore } from './constructor/useGraphEditorStore.js';
import { graphDocumentToStacks, persistCanvasBlob, loadPersistedCanvasBlob } from './constructor/graph_document/graph_migration_bridge.js';
import { GraphCanvas } from './builder/GraphCanvas.jsx';
import { DebugTracePanel } from './builder/DebugTracePanel.jsx';`,
  );
}

s = s.replace(
  '  const [stacks, setStacks] = useState([]);',
  `  const graph = useGraphEditorStore();
  const stacks = graph.stacksView;`,
);

// setStacks([]) and normalizeStudioStacks loads → replaceStacks
s = s.replace(/setStacks\(\[\]\)/g, 'graph.replaceStacks([])');
s = s.replace(/setStacks\(normalizeStudioStacks/g, 'graph.replaceStacks(normalizeStudioStacks');
// remaining setStacks → mutateStacks
s = s.replace(/setStacks\(/g, 'graph.mutateStacks(');

s = s.replace(
  `function saveCanvasForKey(key, stacks, offset, scale) {
  try {
    localStorage.setItem(key, JSON.stringify({ stacks: normalizeStudioStacks(stacks), offset, scale }));`,
  `function saveCanvasForKey(key, graphEditor, offset, scale) {
  try {
    const blob = persistCanvasBlob(graphEditor.getGraphDocument(), { includeLegacyStacks: true });
    blob.viewport = { x: offset.x, y: offset.y, zoom: scale };
    localStorage.setItem(key, JSON.stringify(blob));`,
);

s = s.replace(
  'function generateDslFromStacks(stacks) {',
  `function generateDslFromGraphDocument(getDocument) {
  const stacks = graphDocumentToStacks(typeof getDocument === 'function' ? getDocument() : getDocument);`,
);

s = s.replace(/generateDslFromStacks\(stacks\)/g, 'generateDslFromGraphDocument(graph.getGraphDocument)');

fs.writeFileSync(appPath, s);
console.log('migrate-app-graph.mjs: ok');
