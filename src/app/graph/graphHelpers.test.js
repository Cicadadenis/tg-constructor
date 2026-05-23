import assert from 'node:assert/strict';
import { createGraphEditorStore } from '../../constructor/graph_document/graph_editor_store.js';
import {
  graphHasNodeOfType,
  graphHasRunnableBot,
  graphResolveBotToken,
  injectBotTokenInPython,
} from './graphHelpers.js';

const store = createGraphEditorStore();
const graph = {
  getGraphDocument: () => store.getGraphDocument(),
  dispatch: (...args) => store.dispatch(...args),
};

store.dispatch('AddNode', {
  nodeId: 'b1',
  type: 'cicada',
  position: { x: 0, y: 0 },
  data: { type: 'bot', token: '' },
});

assert.equal(graphHasNodeOfType(graph, 'bot'), true, 'cicada-wrapped bot must count as bot block');

store.dispatch('AddNode', {
  nodeId: 'b2',
  type: 'bot',
  position: { x: 100, y: 0 },
  data: { token: '123:ABCdef' },
});

assert.equal(graphHasRunnableBot(graph, null), true);
assert.equal(graphResolveBotToken(graph, null), '123:ABCdef');

const py = injectBotTokenInPython('BOT_TOKEN = "YOUR_BOT_TOKEN"\nbot = Bot(token="YOUR_BOT_TOKEN")', '999:REAL');
assert.match(py, /BOT_TOKEN = "999:REAL"/);
assert.match(py, /Bot\(token="999:REAL"\)/);

assert.equal(graphHasRunnableBot(graph, { test_token: '555:FromProfile' }), true);

console.log('graphHelpers.test.js: ok');
