import assert from "node:assert/strict";

import {
  SYSTEM_TEMPLATE_IDS,
  listSystemTemplates,
  buildTemplateBotIR,
  templateToGraph,
  templateToGraphViaIR,
  botIRToGraphDocument,
  isSystemTemplateId,
} from "../../core/templates/index.ts";
import { graphToBotIR } from "../../core/ir/bot_ir";

assert.equal(SYSTEM_TEMPLATE_IDS.length, 4);
assert.equal(listSystemTemplates().length, 4);
assert.ok(isSystemTemplateId("shop_bot"));
assert.equal(isSystemTemplateId("unknown"), false);

for (const id of SYSTEM_TEMPLATE_IDS) {
  const ir = buildTemplateBotIR(id);
  assert.equal(ir.context.metadata.systemTemplate, id);
  assert.ok(ir.nodes.length >= 4);
  assert.ok(ir.nodes.some((n) => n.type === "start" || n.type === "command"));
  assert.equal(ir.version, "1.0");

  const graph = templateToGraph(id);
  assert.equal(graph.metadata?.systemTemplate, id);
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : Object.values(graph.nodes || {});
  assert.ok(nodes.length >= 4);

  const round = templateToGraphViaIR(id);
  const roundNodes = Array.isArray(round.nodes) ? round.nodes : Object.values(round.nodes || {});
  assert.equal(roundNodes.length, ir.nodes.length);

  const backIr = graphToBotIR(graph);
  assert.equal(backIr.nodes.length, ir.nodes.length);
}

const shop = buildTemplateBotIR("shop_bot");
assert.ok(shop.nodes.some((n) => n.type === "foreach"));
assert.ok(shop.nodes.some((n) => n.type === "global"));

const admin = buildTemplateBotIR("admin_panel");
assert.ok(admin.nodes.some((n) => n.type === "require_role"));

const support = buildTemplateBotIR("support_bot");
assert.ok(support.nodes.some((n) => n.type === "ask"));

const referral = buildTemplateBotIR("referral_system");
assert.ok(referral.nodes.some((n) => n.type === "set_variable"));

const projected = botIRToGraphDocument(shop);
assert.ok(Array.isArray(projected.nodes));
assert.ok(projected.nodes!.length >= shop.nodes.length);

console.log("system_templates test OK");
