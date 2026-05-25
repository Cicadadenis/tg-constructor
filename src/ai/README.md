# AI-first Flow Generation

Conversational ManyChat / Notion AI-style flow studio.

## Features

| # | Feature | Where |
|---|---------|--------|
| 1 | **Prompt → Flow** | `AiFlowStudio` — chat + `/api/ai-generate` + fallback `build_stacks` |
| 2 | **AI node suggestions** | `AiCopilotPanel` → `suggest_nodes` |
| 3 | **AI copywriting** | Copilot + inspector header → `copywriting` |
| 4 | **AI optimization** | Copilot → `optimize` |
| 5 | **AI auto-repair** | Copilot → `repair` + `graph_auto_repair` |
| 6 | **Onboarding generation** | Prompt chips + `flowPlanToStacks` preset |

## Generated artifacts

- **nodes** — start, message, buttons, ask, condition, delay, …
- **connections** — auto-chained in stack order via `compileAppendStacks`
- **conditions** — `condition` blocks with `cond` props
- **delays** — `delay` with `seconds`
- **messages** — niche-specific copy (salon, onboarding, …)

## UI

- **AiFlowStudio** — conversational modal, quick chips, templates drawer
- **AiCopilotPanel** — inspector rail when a step is selected

## API

- `POST /api/ai/assist` — plan, generate, build_stacks, suggest_nodes, optimize, repair, copywriting, branches
- `POST /api/ai-generate` — full LLM pipeline

## Core

- `core/ai/flowIntentExtensions.mjs` — niche + plan
- `core/ai/flowPlanToStacks.mjs` — deterministic stacks
- `core/ai/flowAssistEngine.mjs` — copilot rules

## Examples

```
Сделай onboarding flow
→ onboarding preset → visual stack on canvas

Сделай автоворонку для салона
→ salon_funnel → message, buttons, ask, condition, delay
```
