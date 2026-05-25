# Product layer — subscriber-centric CRM

Built **on top of** `core/subscriber/` without modifying execution IR or compiler defaults.

## Modules

| Module | Path | Role |
|--------|------|------|
| **Product layer** | `subscriber/productSubscriberLayer.ts` | Bootstrap: repos + stateManager + audience + pipeline |
| **Event pipeline** | `subscriber/eventPipeline.ts` | Bus → handlers → flow triggers |
| **Audience engine** | `subscriber/audienceEngine.ts` | Segments, filters, expressions |
| **Flow blocks** | `subscriber/flowBlockCatalog.ts` + `blockRegistry.js` | `add_tag`, `set_subscriber_field`, `audience_condition`, … |
| **Capability extensions** | `subscriber/registerProductExtensions.ts` | Opt-in executors for subscriber actions |

## Frontend

- `src/product/subscriber/subscriberStore.js` — Zustand CRM store
- `src/product/subscriber/subscriberApi.js` — REST client
- `src/product/subscriber/eventPipeline.js` — UI event fan-out
- `src/product/subscriber/audienceEngine.js` — filter expression builders

## Flow execution (subscriber state)

```ts
import { createProductSubscriberLayer } from "./product/subscriber/index.js";

const layer = createProductSubscriberLayer({ mode: "memory" });
const ctx = createExecutionContext({ user: { id: 123 }, vars: {} });

await layer.bindFlowExecution(ctx, "my_bot");

const schedulerOpts = layer
  .createRuntimeAdapter("my_bot", "flow_1")
  .extendSchedulerOptions({ execution: ctx });

await scheduler.start(schedulerOpts);
```

## HTTP API

Registered via `registerSubscriberRoutes(app)` in `server.mjs`:

- Subscribers, tags, custom fields, variables, sessions, events
- Segments + evaluate
- Audience evaluate (`POST /api/bots/:botId/audience/evaluate`)

## Non-breaking guarantee

- Runtime scheduler uses legacy `applyExecutionEffects` unless `subscriberStateManager` is passed (or bound on `ctx.temp`).
- Compiler / Bot IR / Python codegen unchanged.
- Product capability executors no-op when subscriber context is not bound.
