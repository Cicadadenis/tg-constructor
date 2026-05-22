# Semantic Navigation Model

Intent-based navigation over execution traces **without** changing execution semantics.

## Position in the stack

```
Execution (authority) → Trace (LEVEL_0) → Intelligence (projections) → Navigation (story)
```

| Layer | Question it answers |
|-------|---------------------|
| **Debug / Intelligence** | What happened, how long, diff, replay steps? |
| **Semantic Navigation** | What was the *intent flow* — init → route → process → wait → resume → finalize? |

Navigation is a **read-only story projection** on top of LEVEL_0. It is not a second execution engine.

## Debug vs navigation

| Aspect | Debug / Intelligence | Semantic Navigation |
|--------|----------------------|---------------------|
| Unit | Events, nodes, timings | Phases and intents |
| Output | Compressed trace, overlay, replay | `ExecutionStory`, storyline |
| Goal | Scale + verify equivalence | Human comprehension |
| Affects replay | No (when using LEVEL_0 only) | **Never** |

## Trace vs story

| Artifact | Role |
|----------|------|
| `ExecutionTrace.events` | Canonical record (LEVEL_0) |
| `ExecutionStory.segments` | Lossless grouping of seq ranges into phases |

Every event `seq` appears in **exactly one** `SemanticSegment`. No events invented; no nodes outside LEVEL_0 (or transition targets recorded in trace).

## Story phases

| Phase | Typical LEVEL_0 kinds |
|-------|------------------------|
| `INIT` | `execution_start` |
| `ROUTE` | `handler_matched`, `transition_taken`, `condition_evaluated` |
| `PROCESS` | `node_enter`, `node_exit`, `action_executed`, `error_event` |
| `WAIT` | `suspend` |
| `RESUME` | `resume` |
| `FINALIZE` | `execution_end` |

Phases are **labels for contiguous event groups**, not runtime states.

## Semantic grouping rules

1. Single pass over ordered LEVEL_0 events.
2. Merge adjacent events with the same phase.
3. Record `seq_start`, `seq_end`, `event_seqs`, and `node_ids` (from events only).
4. `validate_story_lossless(trace, story)` — covered seqs == all trace seqs.

## Navigation API

```python
from cicada_platform.debug.semantic_navigator import SemanticNavigator

nav = SemanticNavigator(graph)  # graph optional; used only for op labels in explain_path

story = nav.get_story(trace)
print(story.storyline)

for seg in nav.jump_to_phase(trace, "PROCESS"):
    print(seg.intent, seg.seq_start, seg.seq_end)

expl = nav.explain_path(trace, node_id)
units = nav.collapse_units(trace)
nav.navigate_by_intent(trace, "suspend")
```

## Constraints (hard)

- **NO** mutation of `ExecutionTrace`
- **NO** semantic output fed into replay or control plane
- **ONLY** derived grouping over LEVEL_0
- Story must pass `validate_story_lossless`

## Related contracts

- [SEMANTIC_MODEL_FINAL.md](./SEMANTIC_MODEL_FINAL.md)
- [EXECUTION_EQUIVALENCE_CONTRACT.md](./EXECUTION_EQUIVALENCE_CONTRACT.md)
- [EXECUTION_DEBUGGING.md](./EXECUTION_DEBUGGING.md)

## Verification

```bash
pytest tests/test_semantic_navigation.py -q
```
