"""INTELLIGENCE LAYER — read-only projections over LEVEL_0 trace."""

from cicada_platform.debug.install import register_layer_bootstrap

register_layer_bootstrap()

from cicada_platform.debug.hooks import (
    HookRegistry,
    dispatch_trace_event,
    get_hook_registry,
    register_hooks,
)
from cicada_platform.debug.performance_overlay import PerformanceOverlay
from cicada_platform.debug.profiler import ExecutionProfiler
from cicada_platform.debug.replay import GraphExecutionReplayer, replay_trace
from cicada_platform.debug.semantic_navigator import SemanticNavigator
from cicada_platform.debug.story_model import ExecutionStory, StoryPhase, build_story_from_trace
from cicada_platform.debug.replay_integrity import canonical_subset_events
from cicada_platform.debug.trace_compression import (
    CompressedTrace,
    compress_trace,
    decompress_trace,
)
from cicada_platform.debug.trace_truth import assert_lossless_roundtrip, traces_equal
from cicada_platform.debug.trace_diff import TraceDiff, diff_traces
from cicada_platform.debug.trace_export import build_trace_export
from cicada_platform.debug.trace_inspector import TraceInspector
from cicada_platform.debug.trace_levels import TraceLevel
from cicada_platform.debug.trace_store import TraceStore, get_trace_store
from cicada_platform.debug.trace_view import SmartTraceView, TraceCategoryFilter

__all__ = [
    "CompressedTrace",
    "ExecutionStory",
    "ExecutionProfiler",
    "SemanticNavigator",
    "StoryPhase",
    "build_story_from_trace",
    "GraphExecutionReplayer",
    "HookRegistry",
    "PerformanceOverlay",
    "SmartTraceView",
    "TraceCategoryFilter",
    "TraceDiff",
    "TraceInspector",
    "TraceLevel",
    "TraceStore",
    "assert_lossless_roundtrip",
    "build_trace_export",
    "canonical_subset_events",
    "compress_trace",
    "decompress_trace",
    "diff_traces",
    "traces_equal",
    "dispatch_trace_event",
    "get_hook_registry",
    "get_trace_store",
    "register_hooks",
    "replay_trace",
]
