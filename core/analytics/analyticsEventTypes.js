/**
 * ManyChat-style analytics event taxonomy.
 */

export const AnalyticsEventTypes = Object.freeze({
  // Flow lifecycle
  FLOW_STARTED: 'flow.started',
  FLOW_COMPLETED: 'flow.completed',
  FLOW_FAILED: 'flow.failed',
  FLOW_SUSPENDED: 'flow.suspended',

  // Node execution
  NODE_ENTER: 'node.enter',
  NODE_EXIT: 'node.exit',
  NODE_ERROR: 'node.error',
  NODE_SKIP: 'node.skip',

  // Messaging
  MESSAGE_SENT: 'message.sent',
  MESSAGE_OPENED: 'message.opened',
  MESSAGE_DELIVERED: 'message.delivered',

  // Engagement
  BUTTON_CLICK: 'button.click',
  INLINE_CLICK: 'inline.click',
  REPLY_CLICK: 'reply.click',

  // Conversion
  CONVERSION_GOAL: 'conversion.goal',
  CONVERSION_STEP: 'conversion.step',

  // Custom / block
  ANALYTICS_EVENT: 'analytics.event',

  // Session
  SESSION_START: 'session.start',
  SESSION_END: 'session.end',
  USER_ACTIVE: 'user.active',

  // Runtime observability
  EXECUTION_TRACE: 'execution.trace',
  RUNTIME_ERROR: 'runtime.error',
  RUNTIME_LOG: 'runtime.log',
});

export const ANALYTICS_EVENT_PREFIX = 'analytics.';
