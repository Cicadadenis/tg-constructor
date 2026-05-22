Design note: ExecutionContext model for edge-first traversal

Each stack produced by `flowToStacks` includes `meta.executionContext` with:
- rootNodeId
- routeType
- handlerType
- asyncContext (boolean)
- callbackContext (boolean)
- fsmContext: { enabled: boolean }
- parentHandlerId
- executionPath: array of node ids (strings)

Propagation rules: start at root; `asyncContext` true when root is an event handler; when encountering `callback` node set `callbackContext` true; when encountering any `ROLE_FSM` set `fsmContext.enabled=true` for remainder of path.
