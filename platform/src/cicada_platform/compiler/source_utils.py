from __future__ import annotations

import hashlib


def source_hash(source: str) -> str:
    return hashlib.sha256((source or "").encode("utf-8")).hexdigest()
