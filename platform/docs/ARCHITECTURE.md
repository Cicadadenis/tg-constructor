# Cicada Platform Architecture

## Project structure (new modular platform)

```text
platform/
├── pyproject.toml              # Python 3.13+, FastAPI, Pydantic v2
├── docs/
│   ├── ARCHITECTURE.md         # this file
│   ├── DEPENDENCY_GRAPH.md
│   ├── EXECUTION_FLOW.md
│   ├── MIGRATION.md
│   └── RISKS_AND_SCALING.md
├── tests/
└── src/cicada_platform/
    ├── core/                   # events, contracts, schemas, DI, observability
    │   ├── events/             # CicadaEvent, EventBus, EffectEnvelope
    │   ├── interfaces/         # TransportPlugin, KeyValueStore, …
    │   ├── schemas/            # IR, AST snapshots (Pydantic v2)
    │   ├── di/                 # Container
    │   ├── logging|tracing|metrics|retry|scheduler|queue/
    ├── compiler/               # DSL → Parser → AST → IR (no runtime exec)
    ├── runtime/                # async engine, dispatcher, state machine
    │   └── actions/            # ActionRegistry builtins
    ├── transport/              # plugins: telegram, discord, web, rest, webhook
    ├── storage/                # memory, file, redis*, postgres*
    ├── sandbox/                # queue → isolated worker → result
    ├── builder/                # graph, validation, hot reload
    ├── plugins/                # PluginManager
    ├── sdk/                    # CicadaPlugin, PluginBuilder
    └── api/                    # FastAPI routes + CLI
```

**Legacy (unchanged production path):**

```text
cic-st-core/cicada/     # sync executor + parser (cicada-studio 0.0.1)
src/                    # React visual constructor
server.mjs              # Node API + dslRunner spawn
core/dslCodegen.js      # stacks → DSL
```

## Layer responsibilities

| Layer | Role | Telegram? |
|-------|------|-----------|
| `core` | Domain events, IR contracts, DI, observability | No |
| `compiler` | DSL → AST → IR via legacy parser bridge | No |
| `runtime` | Event-driven async execution, actions, FSM | No |
| `transport` | Inbound normalize + outbound deliver | Only in plugins |
| `storage` | KV, sessions, cache, files | No |
| `sandbox` | Isolated job queue/workers | No |
| `builder` | Visual graph → IR (phase 2) | No |
| `plugins` | Register actions/transports/events | Optional |
| `sdk` | Plugin authoring API | Optional |
| `api` | HTTP compile/execute/sandbox | No |

## Design principles

- **Clean architecture**: dependencies point inward (transport → runtime → core).
- **SOLID**: `TransportPlugin` / `ActionRegistry` / `CicadaPlugin` are extension points.
- **Async-first**: `RuntimeEngine.handle_event` is async; sync legacy stays in `cic-st-core`.
- **No giant files**: parser remains in legacy until incremental port.
- **No DSL in runtime**: only `IrProgram` is executed.

## Integration with Cicada Studio

1. Studio UI keeps generating DSL (`core/dslCodegen.js`).
2. New path: `POST /v1/compile` → IR JSON for debugger/validation.
3. Bot run (today): `services/dslRunner.mjs` → `cicada` CLI (legacy).
4. Target: `dslRunner` → platform API sandbox queue or sidecar worker.

See `MIGRATION.md`, `EXECUTION_FLOW.md`, `DEPENDENCY_GRAPH.md`, `RISKS_AND_SCALING.md`.
