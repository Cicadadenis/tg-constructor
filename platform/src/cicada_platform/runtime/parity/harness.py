"""Parity harness removed: platform runtime executes graph IR only."""


def _removed() -> None:
    raise RuntimeError(
        "Legacy parity harness was removed in IR-only migration. "
        "Use graph-native runtime checks."
    )


def effects_from_legacy_oracle(*_args, **_kwargs):
    _removed()


def effects_from_graph_engine(*_args, **_kwargs):
    _removed()


def run_parity(*_args, **_kwargs):
    _removed()


def graph_covers_legacy_ops(*_args, **_kwargs):
    _removed()


def assert_native_never_calls_handle(*_args, **_kwargs):
    _removed()
