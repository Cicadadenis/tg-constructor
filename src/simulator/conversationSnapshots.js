/**
 * Conversation replay snapshots — full state per simulator step.
 */

let stepCounter = 0;

/**
 * @param {object} state
 * @returns {object}
 */
export function createConversationSnapshot(state) {
  stepCounter += 1;
  return Object.freeze({
    id: `snap-${stepCounter}-${Date.now()}`,
    ts: Date.now(),
    messages: structuredClone(state.messages ?? []),
    variables: structuredClone(state.variables ?? {}),
    subscriberSnapshot: structuredClone(state.subscriberSnapshot ?? null),
    executionPath: structuredClone(state.executionPath ?? []),
    activeNodeId: state.activeNodeId ?? null,
    lastTraceId: state.lastTraceId ?? null,
    lastBranchPort: state.lastBranchPort ?? null,
    inbound: state.inbound ?? null,
  });
}

/**
 * @param {object} snapshot
 */
export function restoreFromSnapshot(snapshot) {
  if (!snapshot) return null;
  return {
    messages: structuredClone(snapshot.messages ?? []),
    variables: structuredClone(snapshot.variables ?? {}),
    subscriberSnapshot: structuredClone(snapshot.subscriberSnapshot ?? null),
    executionPath: structuredClone(snapshot.executionPath ?? []),
    activeNodeId: snapshot.activeNodeId ?? null,
    lastTraceId: snapshot.lastTraceId ?? null,
    lastBranchPort: snapshot.lastBranchPort ?? null,
    replayIndex: Math.max(0, (snapshot.messages?.length ?? 1) - 1),
  };
}
