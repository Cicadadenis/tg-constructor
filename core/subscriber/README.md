# Subscriber architecture (ManyChat-style)

Flow execution can revolve around **subscriber state** without changing `GraphDocument` or the execution IR.

## Layers

| Layer | Path | Role |
|-------|------|------|
| **Entities** | `entities/types.ts`, `entities/ids.ts` | Subscriber, Conversation, Session, Tags, Custom Fields, Events, Segments, Variables |
| **Repositories** | `repositories/interfaces.ts` | Persistence contracts |
| **Persistence** | `repositories/inMemoryRepositories.ts`, `repositories/executionDbRepositories.ts` | In-memory (dev) or `ExecutionDbAccess` (durable) |
| **Services** | `services/*.ts` | Domain logic + `SubscriberStateManager` orchestration |
| **Segmentation** | `segmentation/segmentEngine.ts`, `dynamicConditionEvaluator.ts` | Audience filters + flow conditions |
| **Events** | `events/subscriberEventBus.ts`, `eventTriggerService.ts` | Pub/sub + flow triggers |
| **Runtime adapters** | `runtime/subscriberRuntimeAdapter.ts`, `subscriberExecutionBridge.mjs` | Opt-in wiring to execution kernel |

## Runtime integration (opt-in)

```ts
import { bootstrapSubscriberRuntime, SubscriberRuntimeAdapter } from "./index.js";

// Full setup (repos + BRANCH extensions + event triggers)
const { stateManager } = bootstrapSubscriberRuntime({ mode: "executionDb" });

// Or per-run adapter
const adapter = new SubscriberRuntimeAdapter({ botId: "my_bot" });
await adapter.prepareExecutionContext(ctx);
const opts = adapter.extendSchedulerOptions({ execution: ctx });
```

- **Compiler / BotIR** — unchanged; `node.type` stays runtime (`message`, `condition`, …).
- **Execution scheduler** — unchanged unless you call `registerSubscriberCapabilityExtensions()` (extends `BRANCH` when subscriber context is bound).
- **Effects** — `applyExecutionEffectsWithSubscriber()` routes tag/field/variable effects alongside core effects.

## Subscriber-centric variables

After `bindExecutionContext()`:

- `subscriber.<field>` — custom fields  
- `attr.<key>` — user attributes  
- `session.<key>` — session variables  
- `__subscriberId`, `__conversationId`, `__sessionId`

## Dynamic conditions

Condition nodes can use marketer-friendly expressions:

- JSON filter: `{"op":"hasTag","tag":"vip"}`
- Shorthand: `tag:vip`, `field:plan=pro`, `attr:locale=en`, `event:subscriber.goal_reached`
- Expressions: `tags includes vip`, `subscriber.score > 10`

Evaluated via `SubscriberStateManager.evaluateCondition(ctx, expression)`.

## HTTP API (optional)

`server/routes/subscribers.mjs` — register with Express:

```js
import { registerSubscriberRoutes } from "./routes/subscribers.mjs";
registerSubscriberRoutes(app);
```

## Persistence modes

```ts
createSubscriberRepositories({ mode: "memory" });      // default
createSubscriberRepositories({ mode: "executionDb", db }); // shared ExecutionDb
```
