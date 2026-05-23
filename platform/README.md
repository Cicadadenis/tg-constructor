# Cicada Platform

Modular, event-driven runtime for the Cicada Studio visual constructor.

- **Legacy runtime** (`cic-st-core/cicada/`) remains the production path until migration completes.
- **This package** is the new architecture: DSL → AST → IR → async executor, transport plugins, sandbox workers.

Quick start:

```bash
cd platform
pip install -e ".[dev,telegram]"
set CICADA_GRAPH_NATIVE_MODE=1
cicada-platform serve --reload
pytest tests/parity -q
```

Graph IR is the **single source of truth** for execution structure. Legacy `Executor` is an oracle/fallback shim only.

See `docs/ARCHITECTURE.md` for structure, execution flow, and migration plan.
