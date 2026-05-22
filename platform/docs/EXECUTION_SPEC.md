# Execution Specification (GraphControlPlane)

Normative semantics for the Cicada graph runtime. Implementation lives in
`runtime/control_plane/*`; this document is the contract those modules must satisfy.

## 1. Scope

- **In scope:** one inbound transport event → one execution context → effects + optional trace.
- **Out of scope:** compilation, legacy `Executor`, transport delivery guarantees.

## 2. Definitions

| Term | Meaning |
|------|---------|
| **Event** | One Telegram-style `update` dict (`message` or `callback_query`). |
| **Execution context** | `UserSession` for `chat_id`, plus trace with unique `trace_id`. |
| **Entry node** | Graph node id chosen by `GraphRouter` before traversal. |
| **Traversal** | Deterministic walk along `next` / `true` / `false` / `loop_*` / `suspend_resume` edges. |
| **Effect** | Entry in `NativeRuntime.effects` and/or transport I/O from `native_core`. |

## 3. Event → entry node resolution

**Module:** `GraphRouter` (routing layer only).

### 3.1 Lifecycle per event

1. Allocate new `ExecutionTrace` with new `trace_id`.
2. Emit `execution_start`.
3. Resolve or create session (`UserSession`) for `message.chat.id`.
4. Run `before_each` handlers (graph entries, in handler table order).
5. If `ctx._return_requested` → skip body, go to step 8.
6. **Resume short-circuit:** if `ctx.waiting_for` is set, `GraphResume.resume_input` runs (see §6); then step 8.
7. **Route body:**
   - Callback: exact → prefix → generic callback → fallback text match.
   - Message: media handlers OR text (non-command) OR command/start resolution via `entry.py`.
8. If scenario transition flag set → `GraphScenarios.continue_steps`.
9. Run `after_each` handlers.
10. Emit `execution_end`; flush pending outbound via traversal exit or resume.

### 3.2 Determinism

- Entry list order is fixed by `entry.py` and handler priority at compile time.
- Multiple entry nodes run **sequentially** in list order until `_return_requested`.

## 4. Traversal rules (DAG semantics)

**Module:** `GraphTraversal` (only layer that calls `execute_node` for IR nodes).

### 4.1 Walk algorithm

```
current := start_node
steps := 0
while current and steps < 10_000:
  if current is scenario: or block: → delegate, stop walk
  load node N
  emit node_enter(N)
  switch N.op:
    Noop      → next edge only
    If        → eval condition once → true|false edge (no op body)
    ForEach   → see §4.3
    WhileLoop → see §4.4
    StartScenario → scenarios.start; stop
    default   → NativeOp via registry; then suspend/return/next rules
  emit node_exit(N) when leaving N
  current := chosen successor
flush outbound buffer
```

### 4.2 Edge kinds

| Edge | Use |
|------|-----|
| `next` | Linear successor |
| `true` / `false` | `If` branch only |
| `loop_body` / `loop_exit` | `ForEach` / `WhileLoop` |
| `suspend_resume` | `Ask` / suspend meta → resume target stored on ctx |

### 4.3 ForEach

- Iterable evaluated once; iteration order:
  - `dict` → key order (insertion order, Python 3.7+).
  - `list` / `str` → index order `0..n-1`.
- Each item: bind `stmt.variable`, enter `loop_body` subgraph.
- `LoopBreak` / `LoopContinue` exit inner walk only.

### 4.4 WhileLoop

- Condition evaluated before each body entry.
- Max 100_000 iterations (safety cap).
- Same break/continue semantics as ForEach.

### 4.5 Condition evaluation order

- **If nodes:** condition AST evaluated **before** any successor; exactly one of `true`/`false` edge taken.
- **WhileLoop:** condition evaluated at **head** of each iteration.
- **Expressions inside ops:** evaluated at op invocation time (native_core / `EvalShim`).
- No speculative evaluation of untaken branches.

## 5. Suspend / resume lifecycle

**Module:** `GraphResume` (only layer that may set/clear `waiting_for` and `_graph_resume_node`).

### 5.1 Suspend

- Trigger: `Ask` op or node `meta.suspend` after op sets `ctx.waiting_for`.
- Emit `suspend` with `node_id`, `waiting_for`.
- Store `_graph_resume_node` from `suspend_resume` edge if present.
- Traversal stops; no further `next` edges from suspending node.

### 5.2 Resume

On next event, if `waiting_for` is set **before** routing:

1. Bind input to variable (with `auto_cast`).
2. Clear `waiting_for`.
3. Emit `resume` with `mode`:
   - `scenario` → `GraphScenarios.continue_steps`
   - `graph_node` → `run_graph(resume_node)`
   - `pending_statements` → linear op replay via `traversal.run_native_op`
4. No duplicate routing for same event after resume short-circuit.

### 5.3 Resume chain (trace contract)

Within one `trace_id`, ordered `suspend` → `resume` pairs reconstruct the continuation path. Cross-event ask (suspend on event *n*, resume on event *n+1*) links via session state (`waiting_for`); resume is logged on the resuming event's trace.

## 6. Scheduler semantics

**Module:** `GraphScheduler` (extension point).

- `Sleep` / `Timeout` ops: synchronous sleep in effect layer today.
- No deferred queue in control plane; timers do not bypass traversal ordering.
- Future async scheduling must not reorder node execution within one `trace_id`.

## 7. Execution invariants

| ID | Invariant |
|----|-----------|
| E1 | **Deterministic node order:** same compiled graph + same event + same session state → identical trace shape (`kind`, `node_id`, `op` sequence) on repeated `handle_update`. Node ids are stable for a fixed IR graph; recompilation may change ids. |
| E2 | **No implicit control-plane I/O:** router/traversal/resume/scenarios do not call transport except via NativeOps/native_core. |
| E3 | **Single active context per event:** one `trace_id`, one session mutation stream per `handle_update`. |
| E4 | **Resume state:** only `GraphResume` sets/clears `waiting_for`, `_graph_resume_node`, pending stmt replay. |
| E5 | **NativeOps gateway:** all `NativeOpRegistry.execute` calls go through `GraphTraversal.run_native_op` (graph nodes or resume replay). |

## 8. Execution Trace Contract

| Field | Rule |
|-------|------|
| `trace_id` | UUID per `handle_update`. |
| `seq` | Monotonic 1..n across all events in trace. |
| Required kinds | `execution_start`, `execution_end`; per node: `node_enter`/`node_exit`; branches: `transition_taken`, `condition_evaluated`; ops: `action_executed`; ask: `suspend`/`resume`. |
| Export | `CICADA_EXEC_TRACE_MODE=1` → `GraphControlPlane.last_execution_trace` JSON document. |

## 9. Public API (stable)

```python
engine = GraphControlPlane(graph, program, tg)
effects = engine.handle_update(update)
# optional:
trace_doc = engine.last_execution_trace  # when CICADA_EXEC_TRACE_MODE=1
```

Aliases: `GraphExecutionEngine` ≡ `GraphControlPlane`.

## 10. Environment flags

| Flag | Effect |
|------|--------|
| `CICADA_GRAPH_NATIVE_MODE=1` | Graph control plane authoritative |
| `CICADA_RUNTIME_STRICT=1` | Missing native op → error |
| `CICADA_EXEC_TRACE_MODE=1` | Full trace export on `last_execution_trace` |
