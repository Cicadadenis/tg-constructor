/**
 * Registry of system template GraphDocument specs.
 */

import {
  SYSTEM_TEMPLATE_IDS,
  type SystemTemplateId,
  type SystemTemplateMeta,
  type SystemTemplateSpec,
} from "./templateTypes.js";

export { SYSTEM_TEMPLATE_IDS };
import { buildShopBotSpec } from "./specs/shopBot.js";
import { buildSupportBotSpec } from "./specs/supportBot.js";
import { buildAdminPanelSpec } from "./specs/adminPanel.js";
import { buildReferralSystemSpec } from "./specs/referralSystem.js";

const BUILDERS: Record<SystemTemplateId, () => SystemTemplateSpec> = {
  shop_bot: buildShopBotSpec,
  support_bot: buildSupportBotSpec,
  admin_panel: buildAdminPanelSpec,
  referral_system: buildReferralSystemSpec,
};

const META: Record<SystemTemplateId, SystemTemplateMeta> = {
  shop_bot: {
    id: "shop_bot",
    title: "Shop Bot",
    description: "Каталог товаров с inline-кнопками и оформлением заказа",
    tags: ["commerce", "catalog"],
  },
  support_bot: {
    id: "support_bot",
    title: "Support Bot",
    description: "Тикеты поддержки и статус обращения",
    tags: ["support", "ask"],
  },
  admin_panel: {
    id: "admin_panel",
    title: "Admin Panel",
    description: "Админ-команды с require_role admin",
    tags: ["admin", "permissions"],
  },
  referral_system: {
    id: "referral_system",
    title: "Referral System",
    description: "Реферальные коды и учёт приглашений",
    tags: ["referral", "growth"],
  },
};

export function isSystemTemplateId(id: string): id is SystemTemplateId {
  return id in BUILDERS;
}

export function listSystemTemplates(): SystemTemplateMeta[] {
  return Object.values(META);
}

export function getSystemTemplateMeta(id: SystemTemplateId): SystemTemplateMeta {
  return META[id];
}

/** Raw GraphDocument seed for a system template. */
export function getSystemTemplateSpec(id: SystemTemplateId): SystemTemplateSpec {
  const build = BUILDERS[id];
  if (!build) {
    throw new Error(`Unknown system template: ${id}`);
  }
  return build();
}
