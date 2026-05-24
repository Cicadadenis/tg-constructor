/**
 * Canonical capability identifiers (actions + transport triggers).
 * Compilers and runtime dispatch by capability id — never by node.type switch.
 */

export {
  CAPABILITY_ACTIONS,
  CAPABILITY_TRIGGERS,
} from "./capabilityIds.mjs";

export type CapabilityActionId =
  (typeof import("./capabilityIds.mjs").CAPABILITY_ACTIONS)[keyof typeof import("./capabilityIds.mjs").CAPABILITY_ACTIONS];

export type CapabilityTriggerId =
  (typeof import("./capabilityIds.mjs").CAPABILITY_TRIGGERS)[keyof typeof import("./capabilityIds.mjs").CAPABILITY_TRIGGERS];

export type CapabilityId = CapabilityActionId | CapabilityTriggerId | string;
