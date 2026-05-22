export function inspectRuntime(runtime) {
  const execution = runtime?.execution;

  if (execution?.edges) {
    console.table(
      execution.edges.map((e) => ({
        from: e.from,
        to: e.to,
        trigger: e.trigger,
        condition: e.condition ?? "",
      })),
    );
  }

  console.log("FSM (derived)", runtime?.fsm);
  console.log("Callbacks (derived)", runtime?.callbacks);
}
