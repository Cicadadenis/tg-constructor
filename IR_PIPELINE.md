# IR Pipeline

## Production pipeline

1. Receive `GraphDocument` JSON
2. Normalize graph model
3. Validate with `validateGraph(graph)`
4. Build normalized AST (`core/codegen/ast/normalize.js`)
5. Validate AST (`core/codegen/ast/validate.js`)
6. Generate Python aiogram3 module (`core/codegen/pipeline.js`)
7. Run as `bot.py` in sandbox/server runner

## Removed paths

- `parse_dsl()` runtime execution
- `/v1/compile` DSL route
- platform `legacy_bridge.py` runtime compile bridge
- DSL-driven constructor execute branch

## Contracts and tests

- zod contracts: `src/constructor/graph_document/contracts.js`
- validation tests: `core/tests/graph-validation.test.mjs`
- examples hydration tests: `core/tests/examples-hydration.test.mjs`
- graph contract tests: `core/tests/graph-contracts.test.mjs`
