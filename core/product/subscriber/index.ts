/**
 * Subscriber product layer — CRM + audience + event pipeline on top of core/subscriber.
 */

export {
  createProductSubscriberLayer,
  createSubscriberProductApi,
  SubscriberProductApi,
  type ProductSubscriberLayer,
  type ProductSubscriberLayerOptions,
} from "./productSubscriberLayer.js";

export { AudienceEngine, type AudienceEvaluateOptions } from "./audienceEngine.js";
export {
  SubscriberEventPipeline,
  type EventPipelineHandler,
  type SubscriberEventPipelineOptions,
} from "./eventPipeline.js";
export {
  SUBSCRIBER_FLOW_BLOCKS,
  SUBSCRIBER_CAPABILITY_ACTIONS,
} from "./flowBlockCatalog.js";
export {
  registerSubscriberProductExtensions,
  resetSubscriberProductExtensionsForTests,
} from "./registerProductExtensions.js";
