# Graph Architecture (IR-only)

## Source of truth

- Single authoring model: `GraphDocument`.
- Persisted project payload: `graph_document` JSON.
- No DSL text, parser, VM, or transpilation path in runtime API.

## Runtime path

`GraphDocument` -> graph projection -> normalized AST -> validated AST -> Python AST/codegen -> `bot.py`

## Validation gates

`validateGraph(graph)` runs:

- before hydrate
- before save
- before export
- before codegen
- before examples load

Checks include orphan nodes, duplicates, cycles, invalid edges/types/callbacks, missing handlers, unreachable nodes, FSM links, schema mismatch, viewport/reference integrity.

## Contracts

`src/constructor/graph_document/contracts.js` defines zod contracts for:

- graph document shape
- export payload
- operation payload
- normalized AST
- codegen snapshot
