import pytest

from cicada_platform.compiler.pipeline import CompilePipeline

SAMPLE = """# Cicada3301
версия "1.0"
бот "TEST_TOKEN"

при старте:
    ответ "Привет"
"""


def test_compile_echo():
    pipe = CompilePipeline()
    result = pipe.compile(SAMPLE)
    assert result.ir.handlers
    assert result.ast.handler_count >= 1
