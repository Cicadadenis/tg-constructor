/**
 * ManyChat-style subscriber architecture — entities, services, repositories, runtime adapters.
 * Opt-in: does not alter GraphDocument or execution IR unless SubscriberRuntimeAdapter is used.
 */

export * from "./entities/types.js";
export * from "./entities/ids.js";

export type { SubscriberRepositories } from "./repositories/interfaces.js";
export {
  createInMemorySubscriberRepositories,
  getDefaultSubscriberRepositories,
  setDefaultSubscriberRepositories,
} from "./repositories/inMemoryRepositories.js";
export {
  createSubscriberRepositories,
  type CreateSubscriberRepositoriesOptions,
  type SubscriberPersistenceMode,
} from "./repositories/factory.js";
export { createExecutionDbSubscriberRepositories } from "./repositories/executionDbRepositories.js";
export * from "./persistence/subscriberDbKeys.js";
export { bootstrapSubscriberRuntime, type SubscriberRuntimeBundle } from "./bootstrap.js";

export { SubscriberService } from "./services/subscriberService.js";
export { ConversationService } from "./services/conversationService.js";
export { SessionService } from "./services/sessionService.js";
export { TagService } from "./services/tagService.js";
export { CustomFieldService } from "./services/customFieldService.js";
export { VariableService } from "./services/variableService.js";
export { EventService } from "./services/eventService.js";
export { SegmentService } from "./services/segmentService.js";
export {
  SubscriberStateManager,
  getDefaultSubscriberStateManager,
  createSubscriberStateManager,
} from "./services/subscriberStateManager.js";

export {
  SubscriberEventTypes,
  isSubscriberDomainEvent,
  SUBSCRIBER_EVENT_PREFIX,
} from "./events/subscriberEventTypes.js";
export {
  SubscriberEventBus,
  getDefaultSubscriberEventBus,
} from "./events/subscriberEventBus.js";

export {
  evaluateSegmentFilter,
  filterSubscribersForSegment,
} from "./segmentation/segmentEngine.js";
export {
  parseConditionExpression,
  evaluateDynamicCondition,
} from "./segmentation/dynamicConditionEvaluator.js";

export { EventTriggerService, type EventTriggerRule } from "./events/eventTriggerService.js";
export {
  registerSubscriberCapabilityExtensions,
  resetSubscriberCapabilityExtensionsForTests,
} from "./runtime/subscriberCapabilityExtensions.js";
export {
  getBoundSubscriberContext,
  setBoundSubscriberContext,
  CTX_SUBSCRIBER_KEY,
} from "./runtime/subscriberContextBinding.js";

export { extractTelegramIdentity } from "./runtime/telegramIdentity.js";
export {
  SubscriberRuntimeAdapter,
  type SubscriberRuntimeAdapterOptions,
} from "./runtime/subscriberRuntimeAdapter.js";

export {
  applyExecutionEffectsWithSubscriber,
  applySubscriberEffects,
  effectsForBlockType,
} from "./runtime/subscriberExecutionBridge.mjs";

export {
  subscriberTagEffect,
  subscriberUntagEffect,
  subscriberSetFieldEffect,
  subscriberSetAttributeEffect,
  subscriberSetVariableEffect,
  subscriberTrackEventEffect,
  freezeSubscriberEffects,
  isSubscriberEffect,
} from "./runtime/subscriberEffects.mjs";
