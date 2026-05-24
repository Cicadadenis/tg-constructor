import assert from 'node:assert/strict';
import {
  exampleKeyForTemplate,
  getFlowStarterTemplates,
  FLOW_STARTER_TEMPLATE_DEFS,
} from './flowTemplates.js';
import { EXAMPLE_GRAPH_FLOWS } from '../exampleGraphFlows.js';

assert.equal(FLOW_STARTER_TEMPLATE_DEFS.length, 4);
assert.equal(exampleKeyForTemplate('welcomeFlow'), 'welcome');
assert.equal(exampleKeyForTemplate('shopBot'), 'shop');
assert.equal(exampleKeyForTemplate('aiAssistant'), 'aiAssistant');
assert.equal(exampleKeyForTemplate('supportBot'), 'supportBot');

for (const def of FLOW_STARTER_TEMPLATE_DEFS) {
  assert.ok(EXAMPLE_GRAPH_FLOWS[def.exampleKey], `missing graph for ${def.exampleKey}`);
}

const en = getFlowStarterTemplates('en');
assert.equal(en[0].name, 'Welcome Flow');
assert.ok(en[0].description.length > 5);

console.log('flowTemplates.test.js: ok');
