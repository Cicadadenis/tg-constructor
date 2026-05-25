/**
 * Subscriber-centric flow block types (product layer).
 * Compiler / BotIR unchanged — runtime maps these via effectsForBlockType + capability executors.
 */

export const SUBSCRIBER_FLOW_BLOCKS = Object.freeze({
  ADD_TAG: "add_tag",
  REMOVE_TAG: "remove_tag",
  SET_FIELD: "set_subscriber_field",
  SET_VARIABLE: "set_subscriber_variable",
  TRACK_EVENT: "track_subscriber_event",
  AUDIENCE_CONDITION: "audience_condition",
  SEGMENT_GATE: "segment_gate",
});

export const SUBSCRIBER_CAPABILITY_ACTIONS = Object.freeze({
  TAG: "subscriber_tag",
  FIELD: "subscriber_field",
  VARIABLE: "subscriber_variable",
  TRACK_EVENT: "subscriber_track_event",
});
