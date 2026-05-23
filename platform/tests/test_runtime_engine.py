import os

from cicada_platform.runtime.parity.harness import run_parity, native_mode


HEADER = '# Cicada3301\nбот "TOKEN"\nпри старте:\n    ответ "hi"\n'
UPDATE = {
    "message": {
        "message_id": 1,
        "chat": {"id": 1, "type": "private"},
        "from": {"id": 1, "first_name": "T"},
        "text": "/start",
    }
}


def test_runtime_parity_native_mode():
    with native_mode(True):
        legacy, platform, ok = run_parity(HEADER, UPDATE, native=True)
    assert ok
    assert legacy == platform
