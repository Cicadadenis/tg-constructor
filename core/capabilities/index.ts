export {
  CAPABILITY_ACTIONS,
  CAPABILITY_TRIGGERS,
  type CapabilityActionId,
  type CapabilityTriggerId,
  type CapabilityId,
} from "./capabilityIds.js";

export {
  resolveNodeCapability,
  resolveHandlerTriggerCapability,
  assertNodeCapabilityRegistered,
  type ResolvedNodeCapability,
} from "./resolveNodeCapability.js";
