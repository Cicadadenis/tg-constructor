/**
 * System template → GraphDocument generator (primary API for editor bootstrap).
 */

import type { BotIRGraph } from "../ir/bot_ir.js";
import type { GraphDocumentInput } from "../ir/bot_ir.js";
import type { SystemTemplateId } from "./templateTypes.js";
import { buildTemplateBotIR } from "./buildTemplateBotIR.js";
import { botIRToGraphDocument } from "./botIrToGraphDocument.js";
import { getSystemTemplateSpec } from "./systemTemplateRegistry.js";

export type { SystemTemplateId, SystemTemplateMeta } from "./templateTypes.js";
export {
  SYSTEM_TEMPLATE_IDS,
  listSystemTemplates,
  getSystemTemplateMeta,
  getSystemTemplateSpec,
  isSystemTemplateId,
} from "./systemTemplateRegistry.js";
export { buildTemplateBotIR } from "./buildTemplateBotIR.js";
export { botIRToGraphDocument } from "./botIrToGraphDocument.js";

/**
 * Direct spec → graph (preserves authored layout from template spec).
 */
export function templateSpecToGraph(templateId: SystemTemplateId): GraphDocumentInput {
  return getSystemTemplateSpec(templateId);
}

/**
 * Template → Bot IR → GraphDocument (round-trip through canonical IR).
 */
export function templateToGraphViaIR(templateId: SystemTemplateId): GraphDocumentInput {
  return botIRToGraphDocument(buildTemplateBotIR(templateId));
}

/**
 * Default template → graph: canonical spec with full metadata.
 */
export function templateToGraph(templateId: SystemTemplateId): GraphDocumentInput {
  return templateSpecToGraph(templateId);
}

/**
 * @param templateId
 * @param options.viaIR when true, rebuild graph from Bot IR projection
 */
export function generateGraphFromTemplate(
  templateId: SystemTemplateId,
  options: { viaIR?: boolean } = {},
): GraphDocumentInput {
  if (options.viaIR) {
    return templateToGraphViaIR(templateId);
  }
  return templateToGraph(templateId);
}

export function getTemplateBotIR(templateId: SystemTemplateId): BotIRGraph {
  return buildTemplateBotIR(templateId);
}
