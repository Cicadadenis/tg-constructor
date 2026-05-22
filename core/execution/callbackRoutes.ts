export function resolveCallbackRoutes(executionGraph: Record<string, any>) {
  const routes: Array<{ callback: string; next: string[] }> = [];

  for (const id in executionGraph) {
    const node = executionGraph[id];

    if (node.type === "callback") {
      routes.push({
        callback: node.data.callback,
        next: node.next || [],
      });
    }
  }

  return routes;
}
