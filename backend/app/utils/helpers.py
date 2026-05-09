"""
helpers.py
General-purpose utility functions for the AirVintage backend.
"""

import hashlib
import time
from typing import Any

# ── In-memory API response cache ──────────────────────────────────────────────
_API_CACHE: dict[str, tuple[float, Any]] = {}
CACHE_TTL = 900  # 15 minutes


def cache_get(url: str) -> Any | None:
    """Return cached data for a URL if still fresh, else None."""
    if url in _API_CACHE:
        cached_time, data = _API_CACHE[url]
        if time.time() - cached_time < CACHE_TTL:
            return data
    return None


def cache_set(url: str, data: Any) -> None:
    """Store data in the in-memory cache for a URL."""
    _API_CACHE[url] = (time.time(), data)


# ── Hashing ────────────────────────────────────────────────────────────────────
def make_short_id(text: str, length: int = 12) -> str:
    """Return a stable short hex ID from any string (e.g. a URL)."""
    return hashlib.md5(text.encode()).hexdigest()[:length]
