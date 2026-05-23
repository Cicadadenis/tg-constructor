# Legacy Problems, Bottlenecks, Security, Scaling

## Critical legacy problems

| Issue | Location | Impact |
|-------|----------|--------|
| **Monolithic executor** (~2300 lines) | `cic-st-core/cicada/executor.py` | Hard to test, blocks async migration |
| **DSL executed via loaded AST** | `runner.py` loads Program once | No IR versioning, no sandbox boundary |
| **Telegram in core path** | `executor.py` → `self.tg` | Violates transport separation (mitigated in `core.py` events only partially) |
| **Duplicate codegen** | `core/dslCodegen.js` + AI IR | Drift risk vs parser |
| **Process spawn sandbox** | `dslRunner.mjs` | OS-level only, no action-level isolation |
| **Sync polling** | `runner.py` + requests | Poor concurrency per bot |
| **Hash-synced mirrors** | `cicada/`, `core/*.py`, vendor | Easy to edit wrong copy |

## Performance bottlenecks

- **Parser + executor in one process** — CPU spikes block polling.
- **JSON file DB** (`cicada.database`) — not suitable for multi-tenant cloud scale.
- **Node `dslRunner` spawn** — cold start per user bot.
- **No IR cache** — re-parse `.ccd` on every reload.
- **Synchronous HTTP** in legacy adapter — blocks executor thread.

**Mitigations (platform):** async engine, sandbox worker pool, Redis queue, IR cache keyed by `source_hash`.

## Security risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| User DSL → arbitrary `http` in bot | High | Sandbox network policy (existing bubblewrap) + action allowlist |
| Token in `.ccd` files | High | Keep redaction; never log tokens (existing `security_utils`) |
| Plugin code execution | High | Signed plugins, separate process, resource limits |
| `TelegramAPI` escape hatch in DSL | Medium | Restrict in IR validator |
| Platform API without auth | High | **Must** add JWT/API keys before public deploy |

## Next scaling steps

1. **Horizontal workers**: Redis/RabbitMQ job queue replacing `InMemoryAsyncQueue`.
2. **State externalization**: Postgres `SessionStore` per `chat_id`.
3. **IR CDN/cache**: compile once, run many.
4. **Observability**: export metrics to Prometheus; OpenTelemetry traces.
5. **Multi-region**: transport plugins stateless; runtime state in DB.
6. **Plugin marketplace**: WASM or subprocess isolation for third-party actions.
