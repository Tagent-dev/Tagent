"""Redis cache for the AI Engine.

Caches:
1. LLM responses (chat, RCA, analysis) — avoid redundant API calls
2. Cluster context — avoid re-fetching from Discovery every request
3. Embeddings — avoid re-computing for identical text

Cache strategy:
- Chat responses: 60s TTL (cluster data changes frequently)
- RCA responses: 120s TTL (analysis is expensive)
- Cluster context: 15s TTL (matches Discovery scan interval)
- Embeddings: 1h TTL (text embeddings don't change)
"""

import hashlib
import json
import os

import redis.asyncio as aioredis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

_client: aioredis.Redis | None = None


async def get_client() -> aioredis.Redis | None:
    """Get or create the async Redis client."""
    global _client
    if _client is not None:
        try:
            await _client.ping()
            return _client
        except Exception:
            _client = None

    try:
        _client = aioredis.from_url(REDIS_URL, decode_responses=True)
        await _client.ping()
        return _client
    except Exception:
        _client = None
        return None


def _hash_key(prefix: str, text: str) -> str:
    """Generate a short cache key from text content."""
    h = hashlib.sha256(text.encode()).hexdigest()[:16]
    return f"tagent:{prefix}:{h}"


# ===== Chat Cache =====

async def get_cached_chat(prompt: str, system: str) -> str | None:
    """Get a cached chat response."""
    client = await get_client()
    if not client:
        return None
    key = _hash_key("chat", f"{system}|{prompt}")
    return await client.get(key)


async def set_cached_chat(prompt: str, system: str, response: str, ttl: int = 60):
    """Cache a chat response."""
    client = await get_client()
    if not client:
        return
    key = _hash_key("chat", f"{system}|{prompt}")
    await client.setex(key, ttl, response)


# ===== RCA Cache =====

async def get_cached_rca(incident_id: str) -> str | None:
    """Get a cached RCA response."""
    client = await get_client()
    if not client:
        return None
    key = f"tagent:rca:{incident_id}"
    return await client.get(key)


async def set_cached_rca(incident_id: str, response: str, ttl: int = 120):
    """Cache an RCA response."""
    client = await get_client()
    if not client:
        return
    key = f"tagent:rca:{incident_id}"
    await client.setex(key, ttl, response)


# ===== Cluster Context Cache =====

async def get_cached_context() -> str | None:
    """Get cached cluster context."""
    client = await get_client()
    if not client:
        return None
    return await client.get("tagent:context:cluster")


async def set_cached_context(context: str, ttl: int = 15):
    """Cache cluster context."""
    client = await get_client()
    if not client:
        return
    await client.setex("tagent:context:cluster", ttl, context)


# ===== Embedding Cache =====

async def get_cached_embedding(text: str) -> list | None:
    """Get a cached embedding vector."""
    client = await get_client()
    if not client:
        return None
    key = _hash_key("embed", text)
    data = await client.get(key)
    if data:
        return json.loads(data)
    return None


async def set_cached_embedding(text: str, embedding: list, ttl: int = 3600):
    """Cache an embedding vector."""
    client = await get_client()
    if not client:
        return
    key = _hash_key("embed", text)
    await client.setex(key, ttl, json.dumps(embedding))


# ===== Cache Stats =====

async def get_stats() -> dict:
    """Get Redis cache statistics."""
    client = await get_client()
    if not client:
        return {"connected": False, "keys": 0}

    try:
        info = await client.info("memory")
        dbsize = await client.dbsize()
        return {
            "connected": True,
            "total_keys": dbsize,
            "memory_used": info.get("used_memory_human", "unknown"),
            "memory_peak": info.get("used_memory_peak_human", "unknown"),
        }
    except Exception:
        return {"connected": False, "keys": 0}


# ===== Cache Invalidation =====

async def invalidate_all():
    """Clear all Tagent cache entries."""
    client = await get_client()
    if not client:
        return
    keys = []
    async for key in client.scan_iter("tagent:*"):
        keys.append(key)
    if keys:
        await client.delete(*keys)
