# Analytics layer (ManyChat-style)

## Pipeline

```
Sources → trackAnalyticsEvent() → InMemoryAnalyticsStore → aggregation → getSnapshot()
                ↓ optional JSONL persist (data/analytics-events.jsonl)
                ↓ SSE /api/analytics/stream
                ↓ AnalyticsHub dashboards
```

## Event taxonomy (`analyticsEventTypes.js`)

| Category | Events |
|----------|--------|
| Flow | `flow.started`, `flow.completed`, `flow.failed`, `flow.suspended` |
| Node | `node.enter`, `node.exit`, `node.error` |
| Messaging | `message.sent`, `message.opened` |
| Engagement | `button.click`, `inline.click`, `reply.click` |
| Conversion | `conversion.goal`, `conversion.step` |
| Session | `session.start`, `session.end`, `user.active` |
| Observability | `execution.trace`, `runtime.log`, `runtime.error` |

## Aggregations (in-memory)

- **Active users** / **live sessions**
- **Execution stats** (started / completed / failed)
- **Funnel** + **drop-off rate** per node
- **Heatmap** (visit intensity)
- **User paths** (top sequences)
- **Open rate** (sent vs opened)
- **Click tracking** (callback labels)
- **Conversion goals**
- **Failed nodes** + **runtime logs** + **trace replay**

## Dashboards (`src/analytics/`)

| Tab | Content |
|-----|---------|
| Overview | Active users, sessions, executions, open rate, sparkline, top clicks |
| Funnel | Step conversion bars |
| Flow | Drop-off + user path analysis |
| Nodes | Heatmap grid + node timing |
| Observability | Failed nodes, logs, trace replay + canvas highlight |

## Wiring

```js
// Server boot only (analyticsApi.mjs)
import { bootstrapAnalyticsLayer } from './core/analytics/server.js';
await bootstrapAnalyticsLayer();

// Browser / simulator
import { trackPreviewStep, trackButtonClick } from './core/analytics/runtimeBridge.js';

// Production scheduler (ExecutionScheduler.start)
import { withSchedulerAnalytics, finalizeSchedulerAnalytics } from './core/analytics/runtimeBridge.js';
const opts = withSchedulerAnalytics({ enableTrace: true }, { flowId, botId, sessionId });
const run = await scheduler.start(opts);
finalizeSchedulerAnalytics(run, { flowId, botId, sessionId });

// Subscriber CRM → analytics (wired inside bootstrap on server)
```

## HTTP API

- `GET /api/analytics/snapshot?flowId=&botId=&since=&until=`
- `GET /api/analytics/stream` (SSE)
- `POST /api/analytics/track`
- `POST /api/analytics/register-flow`
- `GET /api/analytics/trace/:traceId`
- `POST /api/analytics/reset`
