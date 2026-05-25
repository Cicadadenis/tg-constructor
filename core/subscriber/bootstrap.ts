/**
 * Opt-in bootstrap — wire subscriber layer into runtime without breaking defaults.
 */

import { ensureCapabilityExecutorsRegistered } from "../runtime/capabilityExecutors.js";
import {
  createSubscriberRepositories,
  type CreateSubscriberRepositoriesOptions,
} from "./repositories/factory.js";
import { setDefaultSubscriberRepositories } from "./repositories/inMemoryRepositories.js";
import { createSubscriberStateManager } from "./services/subscriberStateManager.js";
import type { SubscriberStateManager } from "./services/subscriberStateManager.js";
import { registerSubscriberCapabilityExtensions } from "./runtime/subscriberCapabilityExtensions.js";
import {
  EventTriggerService,
  type EventTriggerRule,
} from "./events/eventTriggerService.js";
import type { SubscriberEventRecord } from "./entities/types.js";
import type { SubscriberRepositories } from "./repositories/interfaces.js";

export interface BootstrapSubscriberRuntimeOptions extends CreateSubscriberRepositoriesOptions {
  enableCapabilityExtensions?: boolean;
  startEventTriggers?: boolean;
  onFlowTrigger?: (
    rule: EventTriggerRule,
    event: SubscriberEventRecord,
  ) => void | Promise<void>;
}

export interface SubscriberRuntimeBundle {
  repos: SubscriberRepositories;
  stateManager: SubscriberStateManager;
  eventTriggers: EventTriggerService;
}

/**
 * One-call setup for ManyChat-style subscriber-centric flows.
 */
export function bootstrapSubscriberRuntime(
  options: BootstrapSubscriberRuntimeOptions = {},
): SubscriberRuntimeBundle {
  ensureCapabilityExecutorsRegistered();

  const repos = createSubscriberRepositories(options);
  setDefaultSubscriberRepositories(repos);
  const stateManager = createSubscriberStateManager(repos);

  if (options.enableCapabilityExtensions !== false) {
    registerSubscriberCapabilityExtensions(stateManager);
  }

  const eventTriggers = new EventTriggerService(undefined, options.onFlowTrigger);
  if (options.startEventTriggers !== false) {
    eventTriggers.startListening();
  }

  return { repos, stateManager, eventTriggers };
}
