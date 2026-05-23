"""Compile-time compatibility — re-export warnings (no runtime execution)."""

from __future__ import annotations

from cicada_platform.compiler.validate import compile_time_native_coverage_warnings

__all__ = ["compile_time_native_coverage_warnings"]
