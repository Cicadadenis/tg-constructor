/**
 * System template → canonical Bot IR.
 */

import { graphToBotIR, type BotIRGraph } from "../ir/bot_ir.js";
import type { SystemTemplateId } from "./templateTypes.js";
import { getSystemTemplateSpec } from "./systemTemplateRegistry.js";

/**
 * Build prebuilt Bot IR for a system template (via GraphDocument → graphToBotIR).
 */
export function buildTemplateBotIR(templateId: SystemTemplateId): BotIRGraph {
  const spec = getSystemTemplateSpec(templateId);
  const ir = graphToBotIR(spec);
  return {
    ...ir,
    context: {
      ...ir.context,
      metadata: {
        ...ir.context.metadata,
        systemTemplate: templateId,
        templateTitle: spec.metadata.title,
        templateDescription: spec.metadata.description,
      },
    },
  };
}
