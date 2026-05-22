# Core Compatibility Policy

`cic-st-core/cicada/` is the canonical Python runtime for this project (`cicada-studio==0.0.1` package source). Installed `cicada` from pip should match this tree after `pip install` from `cic-st-core/`.

## Architecture Boundaries

- **CORE**: immutable runtime copied from `cicada-studio==0.0.1`. No Studio-specific behavior is allowed here.
- **STUDIO**: UI/editor, DSL drafting, visual blocks, hints, user flows, and presentation.
- **ADAPTERS**: integration layer between Studio and the canonical core/runtime.
- **LEGACY**: isolated obsolete compatibility notes or code. It must not be imported by CORE.

## Canonical and Synchronized Directories

**Canonical** (edit here only):

- `cic-st-core/cicada/`

**@obsolete mirrors** (hash-guarded copies; do not edit by hand):

- `cicada/`
- `core/*.py`, `core/adapters/*.py`, `core/core.py`
- `vendor/cicada-dsl-parser/cicada/`

The canonical path is configured by `CICADA_CANONICAL_CORE`; default:

```bash
cic-st-core/cicada
```

Production runtime uses `cicada.executor` only. `cicada.executor_fixed` is a deprecated re-export stub and must not be imported by Studio services or scripts.

## Hash Verification Policy

- `npm run core:guard` compares every canonical `.py` file against synchronized copies.
- Any missing file or hash mismatch fails the guard.
- The guard also checks `cicada-studio` package version and API surface signatures.
- `npm run build` runs `core:guard` before Vite build, so production builds fail on drift.

## Compatibility Matrix

| Area | Canonical Owner | Studio Role | Guard |
| --- | --- | --- | --- |
| DSL parser | `cicada.parser` | Generate valid DSL and show UX hints | parser parity + core guard |
| Runtime/executor | `cicada.executor`, `cicada.runtime` | Call runtime, display results | runtime parity + core guard |
| Events/effects | `cicada.core` | Normalize UI payloads to runtime requests | API surface + preview parity |
| Telegram adapters | `cicada.adapters.*` | Use through runtime/preview only | adapter compatibility |
| Preview | `cicada.preview_worker` | Send JSON requests, render outbound actions | preview parity |
| Legacy behavior | `legacy/` only | Documentation or migration notes | forbidden import scan |

## Legacy Layer Policy

- Legacy behavior must be marked with `@obsolete`.
- Legacy files live under `legacy/`.
- CORE directories must not import `legacy`.
- Legacy may document old Studio behavior, but it must not restore or override runtime semantics.

Current obsolete expectations:

- `db_template_key`: old Studio rendered `{chat_id}` inside quoted DB keys.
- `scenario_ask_resume_after_media`: old smoke tests expected media answers to resume remaining scenario statements differently.

## Forbidden Overrides

Do not:

- patch parser/executor/runtime behavior directly in synchronized CORE copies;
- add Studio-specific branches to `cicada/`, `core/*.py`, or vendored `cicada/`;
- shadow `cicada` imports with local monkey patches outside tests;
- import `legacy/` from runtime paths;
- change canonical behavior to satisfy UI expectations.

Use adapters/extensions instead:

- `services/*` for backend integration;
- `src/*` for editor/UI transforms;
- explicit adapter modules for boundary conversion.

## Upgrade Protocol

1. Update runtime in `cic-st-core/cicada/` and bump `cicada-studio` version in `cic-st-core/pyproject.toml`.
2. Update `EXPECTED_VERSION` in `scripts/core-guard.mjs` and docs.
3. Copy `cic-st-core/cicada/*.py` into synchronized mirror directories (or run your sync step).
4. Install from `cic-st-core/`, for example `pip install ./cic-st-core`.
5. Run `npm run core:guard`.
6. Run `npm run ci:compat`.
7. Update DSL snapshots/feature matrix only when the new core accepts/rejects syntax differently.
8. Move incompatible Studio assumptions to `legacy/` with `@obsolete`.
9. Never edit mirror copies (`cicada/`, `core/*.py`, `vendor/.../cicada/`) manually to make tests pass.

## Required Commands

```bash
npm run core:guard
npm run ci:compat
npm run build
```
