"""Shared security helpers for Cicada DSL runtime."""

from __future__ import annotations

import hashlib
import ipaddress
import os
import re
import secrets
import socket
import threading
import time
from urllib.parse import urlparse

_RE_BOT_URL_TOKEN = re.compile(r"/bot\d{6,12}:[A-Za-z0-9_-]{25,}", re.IGNORECASE)
_RE_BOT_TOKEN = re.compile(r"\b\d{6,12}:[A-Za-z0-9_-]{25,}\b")
_RE_BOT_LINE = re.compile(r'(бот\s+["\'])[^"\']{8,}(["\'])', re.IGNORECASE)


def redact_secrets(value) -> str:
    """Mask bot tokens and secrets before logging or user-visible errors."""
    text = str(value or "")
    text = _RE_BOT_URL_TOKEN.sub("/bot***redacted***", text)
    text = _RE_BOT_TOKEN.sub("***redacted***", text)
    text = _RE_BOT_LINE.sub(r"\1***redacted***\2", text)
    return text

TELEGRAM_CALLBACK_DATA_MAX = 64
_CALLBACK_ID_PREFIX = "cb_"
_CALLBACK_HASH_PREFIX = "h:"
_DEFAULT_CALLBACK_REGISTRY_TTL = int(
    os.environ.get("CICADA_CALLBACK_REGISTRY_TTL", str(7 * 24 * 3600))
)


def _legacy_callback_hash(raw: str) -> str:
    encoded = str(raw or "").encode("utf-8")
    digest = hashlib.sha256(encoded).hexdigest()[:48]
    return f"{_CALLBACK_HASH_PREFIX}{digest}"


class CallbackDataRegistry:
    """Maps short Telegram callback_data ids to full payloads with TTL."""

    def __init__(self, ttl: int = _DEFAULT_CALLBACK_REGISTRY_TTL, max_entries: int = 100_000):
        self._ttl = max(60, int(ttl))
        self._max_entries = max(1, int(max_entries))
        self._lock = threading.Lock()
        self._by_id: dict[str, tuple[str, float]] = {}
        self._by_payload: dict[str, str] = {}
        self._legacy_hash: dict[str, str] = {}

    def _purge_expired(self, now: float | None = None) -> None:
        ts = time.time() if now is None else now
        for cid, (payload, expires_at) in list(self._by_id.items()):
            if expires_at > ts:
                continue
            self._by_id.pop(cid, None)
            if self._by_payload.get(payload) == cid:
                self._by_payload.pop(payload, None)
        for digest, payload in list(self._legacy_hash.items()):
            cid = self._by_payload.get(payload)
            if not cid or cid not in self._by_id:
                self._legacy_hash.pop(digest, None)

    def _trim_size(self) -> None:
        while len(self._by_id) > self._max_entries:
            cid = next(iter(self._by_id))
            payload, _ = self._by_id.pop(cid)
            if self._by_payload.get(payload) == cid:
                self._by_payload.pop(payload, None)
            digest = _legacy_callback_hash(payload)
            if self._legacy_hash.get(digest) == payload:
                self._legacy_hash.pop(digest, None)

    def register(self, raw: str) -> str:
        text = str(raw or "")
        with self._lock:
            now = time.time()
            self._purge_expired(now)
            existing = self._by_payload.get(text)
            if existing:
                entry = self._by_id.get(existing)
                if entry and entry[1] > now:
                    return existing

            while True:
                cid = f"{_CALLBACK_ID_PREFIX}{secrets.token_hex(4)}"
                if cid not in self._by_id:
                    break

            expires_at = now + self._ttl
            self._by_id[cid] = (text, expires_at)
            self._by_payload[text] = cid
            self._legacy_hash[_legacy_callback_hash(text)] = text
            self._trim_size()
            return cid

    def resolve(self, data: str) -> str | None:
        text = str(data or "")
        if not text:
            return None
        with self._lock:
            now = time.time()
            self._purge_expired(now)
            if text.startswith(_CALLBACK_ID_PREFIX):
                entry = self._by_id.get(text)
                if entry and entry[1] > now:
                    return entry[0]
                return None
            if text.startswith(_CALLBACK_HASH_PREFIX):
                return self._legacy_hash.get(text)
        return None


_CALLBACK_REGISTRY = CallbackDataRegistry()


def get_callback_registry() -> CallbackDataRegistry:
    return _CALLBACK_REGISTRY


def encode_callback_data(raw: str) -> str:
    """Telegram inline callback_data must be <= 64 bytes (UTF-8)."""
    text = str(raw or "")
    encoded = text.encode("utf-8")
    if len(encoded) <= TELEGRAM_CALLBACK_DATA_MAX:
        return text
    return _CALLBACK_REGISTRY.register(text)


def decode_callback_data(data: str) -> str:
    """Resolve cb_/h: callback_data to the original payload when known."""
    text = str(data or "")
    resolved = _CALLBACK_REGISTRY.resolve(text)
    if resolved is not None:
        return resolved
    return text


def legacy_callback_hash(raw: str) -> str:
    """Legacy sha256 digest form used before cb_ ids (for fallback matching)."""
    return _legacy_callback_hash(raw)


def _hostname_resolves_to_blocked_ip(host: str) -> bool:
    host = str(host or "").strip().lower()
    if not host or host == "localhost":
        return True
    if host.endswith((".local", ".internal", ".localhost")):
        return True
    try:
        ip = ipaddress.ip_address(host)
        return bool(
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
        )
    except ValueError:
        pass
    try:
        for info in socket.getaddrinfo(host, None, type=socket.SOCK_STREAM):
            addr = info[4][0]
            try:
                ip = ipaddress.ip_address(addr)
            except ValueError:
                continue
            if (
                ip.is_private
                or ip.is_loopback
                or ip.is_link_local
                or ip.is_reserved
                or ip.is_multicast
            ):
                return True
    except OSError:
        return True
    return False


def validate_http_url(url: str) -> str:
    """Reject SSRF-prone URLs (private networks, non-http schemes)."""
    raw = str(url or "").strip()
    if not raw:
        raise ValueError("HTTP URL is empty")
    parsed = urlparse(raw)
    scheme = (parsed.scheme or "").lower()
    if scheme not in ("http", "https"):
        raise ValueError(f"HTTP scheme not allowed: {scheme or '(none)'}")
    host = parsed.hostname
    if not host:
        raise ValueError("HTTP URL has no host")
    if _hostname_resolves_to_blocked_ip(host):
        raise ValueError("HTTP host is not allowed")
    return raw


def resolve_path_under_base(base_path: str, user_path: str) -> str:
    """Resolve relative path under base; block traversal and absolute paths."""
    rel = str(user_path or "").strip()
    if not rel:
        raise ValueError("path is empty")
    if os.path.isabs(rel) or rel.startswith("~"):
        raise ValueError("absolute paths are not allowed")
    if "\0" in rel:
        raise ValueError("invalid path")
    norm = os.path.normpath(rel)
    if norm.startswith("..") or norm == "..":
        raise ValueError("path traversal is not allowed")
    base = os.path.realpath(os.path.abspath(base_path or os.getcwd()))
    candidate = os.path.realpath(os.path.join(base, norm))
    try:
        common = os.path.commonpath([base, candidate])
    except ValueError as e:
        raise ValueError("path is outside sandbox") from e
    if common != base:
        raise ValueError("path is outside sandbox")
    return candidate


def open_file_under_base(base_path: str, user_path: str, mode: str = "r"):
    """Open file with O_NOFOLLOW when available (symlink hardening)."""
    resolved = resolve_path_under_base(base_path, user_path)
    flags = os.O_RDONLY if "r" in mode and "w" not in mode and "+" not in mode else 0
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    if "w" in mode:
        fd = os.open(resolved, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | getattr(os, "O_NOFOLLOW", 0))
        return os.fdopen(fd, mode, encoding="utf-8")
    fd = os.open(resolved, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    return os.fdopen(fd, mode, encoding="utf-8")
