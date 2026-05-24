/**
 * System template identifiers — prebuilt Bot IR graphs for common bot patterns.
 */

import type { GraphDocumentInput } from "../ir/bot_ir.js";

export const SYSTEM_TEMPLATE_IDS = [
  "shop_bot",
  "support_bot",
  "admin_panel",
  "referral_system",
] as const;

export type SystemTemplateId = (typeof SYSTEM_TEMPLATE_IDS)[number];

export interface SystemTemplateMeta {
  id: SystemTemplateId;
  title: string;
  description: string;
  tags: readonly string[];
}

/** Declarative graph seed before {@link graphToBotIR}. */
export interface SystemTemplateSpec extends GraphDocumentInput {
  metadata: Record<string, unknown> & {
    systemTemplate: SystemTemplateId;
    title: string;
    description: string;
  };
}

export interface TemplateNodeLayout {
  x: number;
  y: number;
}
