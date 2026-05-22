/**
 * Trace Viewer — read-only LEVEL_0 display helpers.
 * No trace mutation.
 */

export function parseLevel0Trace(payload) {
  const events = payload?.trace ?? payload?.events ?? [];
  return {
    traceId: payload?.trace_id ?? null,
    events: Array.isArray(events) ? events.map((e) => Object.freeze({ ...e })) : [],
    export: payload?.trace_export ? Object.freeze({ ...payload.trace_export }) : null,
  };
}

export function buildTimeline(events) {
  return events.map((e) => ({
    seq: e.seq,
    kind: e.kind,
    nodeId: e.node_id ?? null,
    op: e.op ?? null,
    detail: e.detail ?? {},
  }));
}

export function highlightNodesFromTrace(events) {
  const active = new Set();
  const visited = new Set();
  for (const e of events) {
    if (e.node_id) {
      if (e.kind === 'node_enter') active.add(e.node_id);
      if (e.kind === 'node_exit') active.delete(e.node_id);
      visited.add(e.node_id);
    }
  }
  return { active: [...active], visited: [...visited] };
}

export function extractSuspendResume(events) {
  const suspends = [];
  const resumes = [];
  for (const e of events) {
    if (e.kind === 'suspend') suspends.push(e);
    if (e.kind === 'resume') resumes.push(e);
  }
  return { suspends, resumes };
}

export function attachPerformanceOverlay(timeline, traceExport) {
  if (!traceExport?.profiler) return timeline;
  const slow = new Set(
    (traceExport.profiler.slow_nodes || []).map((n) => n.node_id),
  );
  return timeline.map((row) => ({
    ...row,
    perf: { slow: slow.has(row.nodeId) },
  }));
}

/** Immutable replay index for UI scrubber (no execution). */
export function replayIndexFromEvents(events) {
  return events.map((e, i) => ({ index: i, seq: e.seq, kind: e.kind, nodeId: e.node_id }));
}
