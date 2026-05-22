# Migration Plan

## Phase 0 — Foundation (done)

- [x] `platform/` package with layered modules
- [x] Unified `CicadaEvent`, `EventBus`, `EffectEnvelope`
- [x] Compile pipeline DSL → AST → IR (bridge to legacy parser)
- [x] Async `RuntimeEngine` + `ActionRegistry`
- [x] Telegram as `transport/plugins/telegram`
- [x] Sandbox queue/worker skeleton
- [x] FastAPI: `/health`, `/v1/compile`, `/v1/execute`, `/v1/sandbox/*`

## Phase 1 — Parity (4–6 weeks)

- [ ] Expand IR lowering for all statement types (scenarios, loops, inline DB)
- [ ] Port golden tests from `core/tests/dsl-codegen.*` to IR runtime
- [ ] Studio: optional compile via platform API (feature flag)
- [ ] `dslRunner.mjs`: enqueue sandbox jobs instead of spawn when `CICADA_PLATFORM_URL` set
- [ ] Redis/Postgres real implementations (replace placeholders)

## Phase 2 — Cutover (6–10 weeks)

- [ ] Visual builder `RuntimeGraph.to_ir()` full parity with `dslCodegen.js`
- [ ] Deprecate direct `Executor` + `TelegramAdapter` in Studio server path
- [ ] Hot reload + debugger API (`/v1/debug/session`)
- [ ] Plugin marketplace manifest format

## Phase 3 — Multi-transport

- [ ] Discord gateway transport (production)
- [ ] Web runtime (SSE/WS) for in-browser preview
- [ ] Webhook egress for integrations

## Non-breaking rules

- Do not delete `cic-st-core` until Phase 2 sign-off.
- Keep `npm run core:guard` green.
- Node server remains default; platform is opt-in via env.

## Environment

| Variable | Purpose |
|----------|---------|
| `CICADA_PLATFORM_URL` | Studio → platform API |
| `TELEGRAM_BOT_TOKEN` | Transport plugin |
| `DATABASE_URL` | Postgres storage |
| `REDIS_URL` | Cache / queue |
