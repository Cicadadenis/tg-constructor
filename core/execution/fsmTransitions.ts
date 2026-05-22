export function resolveFSMTransitions(executionGraph: Record<string, any>) {
  const transitions: Array<{ from: string; to: string }> = [];

  for (const id in executionGraph) {
    const node = executionGraph[id];

    if (node.type === "fsm") {
      for (const next of node.next) {
        transitions.push({
          from: node.id,
          to: next,
        });
      }
    }
  }

  return transitions;
}
