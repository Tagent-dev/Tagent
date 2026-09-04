"""Tagent AI Engine — local LLM-powered cluster intelligence.

Answers questions about your Kubernetes cluster using:
1. Real cluster data (fetched from Discovery/Monitoring services)
2. Local Ollama LLM (llama3.1:8b) — no cloud APIs, no data leaves your cluster
"""

import asyncio
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from app.routers import analysis, chat, rca
from app.routers import briefing as briefing_router
from app.routers import knowledge as knowledge_router
from app.routers import models as models_router
from app.routers import plugins as plugins_router
from app.routers import predictive as predictive_router
from app.routers import reports as reports_router
from app.routers import risks as risks_router

app = FastAPI(
    title="Tagent AI Engine",
    description="Local LLM-powered Kubernetes incident intelligence",
    version="0.1.0",
)

# Prometheus metrics (auto-instruments all endpoints)
Instrumentator(
    should_group_status_codes=True,
    should_ignore_untemplated=True,
    excluded_handlers=["/health", "/metrics"],
).instrument(app).expose(app, endpoint="/metrics")

# Allow frontend to call the AI Engine directly during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    from app.providers import OllamaProvider
    provider = OllamaProvider()
    ollama_ok = await provider.health()
    return {
        "status": "healthy" if ollama_ok else "degraded",
        "service": "tagent-ai-engine",
        "version": "0.1.0",
        "ollama": "connected" if ollama_ok else "unreachable",
        "model": os.getenv("OLLAMA_MODEL", "llama3.1:8b"),
    }


# Background task: collect telemetry snapshots every 15 seconds for predictive detection
_collector_task = None

@app.on_event("startup")
async def start_predictive_collector():
    global _collector_task
    async def collector_loop():
        from app import predictive
        while True:
            try:
                await predictive.collect_snapshot()
            except Exception:
                pass  # silently continue on errors
            await asyncio.sleep(15)
    _collector_task = asyncio.create_task(collector_loop())


app.include_router(chat.router, prefix="/api/v1/ai", tags=["chat"])
app.include_router(analysis.router, prefix="/api/v1/ai", tags=["analysis"])
app.include_router(rca.router, prefix="/api/v1/ai", tags=["rca"])
app.include_router(knowledge_router.router, prefix="/api/v1/knowledge", tags=["knowledge"])
app.include_router(risks_router.router, prefix="/api/v1/risks", tags=["risks"])
app.include_router(predictive_router.router, prefix="/api/v1/predictive", tags=["predictive"])
app.include_router(plugins_router.router, prefix="/api/v1/plugins", tags=["plugins"])
app.include_router(reports_router.router, prefix="/api/v1/reports", tags=["reports"])
app.include_router(briefing_router.router, prefix="/api/v1/briefing", tags=["briefing"])
app.include_router(models_router.router, prefix="/api/v1/models", tags=["models"])


@app.get("/api/v1/cache/stats")
async def cache_stats():
    from app import cache as redis_cache
    stats = await redis_cache.get_stats()
    return stats


@app.post("/api/v1/cache/invalidate")
async def cache_invalidate():
    from app import cache as redis_cache
    await redis_cache.invalidate_all()
    return {"status": "cleared"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8083"))
    uvicorn.run(app, host="0.0.0.0", port=port)
