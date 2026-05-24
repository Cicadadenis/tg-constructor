export type {
  SystemTemplateId,
  SystemTemplateMeta,
  SystemTemplateSpec,
} from "./templateTypes.js";

export {
  SYSTEM_TEMPLATE_IDS,
  listSystemTemplates,
  getSystemTemplateMeta,
  getSystemTemplateSpec,
  isSystemTemplateId,
} from "./systemTemplateRegistry.js";

export { buildTemplateBotIR } from "./buildTemplateBotIR.js";
export { botIRToGraphDocument } from "./botIrToGraphDocument.js";

export {
  templateToGraph,
  templateToGraphViaIR,
  templateSpecToGraph,
  generateGraphFromTemplate,
  getTemplateBotIR,
} from "./templateToGraph.js";
