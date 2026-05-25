# AI-first Flow Generation

ManyChat / Notion AI-style flow studio for Cicada Constructor.

## Features

| # | Feature | API action |
|---|---------|------------|
| 1 | Natural language → Flow | `plan` + `/api/ai-generate` |
| 2 | AI node suggestions | `suggest_nodes` |
| 3 | AI auto-complete | `autocomplete` |
| 4 | Optimization hints | `optimize` |
| 5 | Flow repair | `repair` |
| 6 | AI copywriting | `copywriting` (rules + optional LLM) |
| 7 | Branch suggestions | `branches` |

## UI

- **AiFlowStudio** — full-screen modal: templates, NL prompt (до 2000 символов), structured plan preview, generate
- **AiCopilotPanel** — inspector rail when a node is selected

## Prompt templates

`promptTemplates.js` — «Автоворонка для салона», «Onboarding flow», поддержка, магазин, и др.

## Backend

- `POST /api/ai/assist` — all copilot actions
- `POST /api/ai-generate` — full stack generation (existing pipeline)
- `core/ai/flowIntentExtensions.mjs` — niche detection + prompt expansion
- `core/ai/flowAssistEngine.mjs` — deterministic assist
- `services/aiGraphPipeline.mjs` — validation pipeline

## Example

```
Сделай автоворонку для салона
→ niche: salon_funnel
→ sequence: start → message → buttons → ask → condition → …
→ expanded prompt → semantic pipeline → visual nodes on canvas
```
