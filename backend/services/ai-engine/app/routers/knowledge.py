"""Knowledge Base router — stores and retrieves incident patterns.

Endpoints:
- GET  /knowledge/entries      → list all knowledge entries
- GET  /knowledge/stats        → knowledge base statistics
- POST /knowledge/search       → semantic similarity search
- POST /knowledge/ingest       → manually add an entry
- POST /knowledge/auto-ingest  → auto-ingest from current incidents
- POST /knowledge/recommend    → get fix recommendations for a query
- PUT  /knowledge/feedback     → update success rate after fix execution
"""

import json
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import knowledge
from app.providers import OllamaProvider

router = APIRouter()
provider = OllamaProvider()


# ===== Request/Response Models =====

class SearchRequest(BaseModel):
    query: str
    limit: int = 5
    threshold: float = 0.5


class IngestRequest(BaseModel):
    title: str
    category: str  # "CrashLoopBackOff", "OOMKilled", "NodeNotReady", "HighLatency", etc.
    description: str
    root_cause: str
    fix_action: str
    severity: str
    service: str
    namespace: str
    tags: list[str] = []
    metadata: dict | None = None


class RecommendRequest(BaseModel):
    query: str
    service: str | None = None
    namespace: str | None = None


class FeedbackRequest(BaseModel):
    entry_id: str
    success: bool


class KnowledgeEntry(BaseModel):
    id: str
    title: str
    category: str
    description: str
    root_cause: str
    fix_action: str
    severity: str
    service: str
    namespace: str
    occurrence_count: int
    success_rate: float
    last_seen_at: str
    first_seen_at: str
    tags: list[str]
    metadata: dict
    similarity: float | None = None


class KnowledgeListResponse(BaseModel):
    entries: list[KnowledgeEntry]
    total: int


class SearchResponse(BaseModel):
    results: list[KnowledgeEntry]
    query: str
    model: str


class RecommendResponse(BaseModel):
    recommendations: list[dict]
    query: str
    model: str


class StatsResponse(BaseModel):
    total_entries: int
    categories: dict
    top_services: list[dict]


# ===== Endpoints =====

@router.get("/entries", response_model=KnowledgeListResponse)
async def list_entries(limit: int = 100, category: str | None = None):
    """List all knowledge base entries."""
    entries = await knowledge.get_all_entries(limit=limit, category=category)
    return KnowledgeListResponse(entries=entries, total=len(entries))


@router.get("/stats", response_model=StatsResponse)
async def get_stats():
    """Get knowledge base statistics."""
    stats = await knowledge.get_stats()
    return StatsResponse(**stats)


@router.post("/search", response_model=SearchResponse)
async def search_knowledge(request: SearchRequest):
    """Search knowledge base using semantic similarity."""
    if not await provider.health():
        raise HTTPException(status_code=503, detail="Ollama not reachable — cannot generate embeddings.")

    # Generate embedding for the query
    embedding = await provider.embed(request.query)
    if not embedding:
        raise HTTPException(status_code=500, detail="Failed to generate embedding.")

    # Search by similarity
    results = await knowledge.search_similar(
        embedding=embedding,
        limit=request.limit,
        threshold=request.threshold,
    )

    return SearchResponse(results=results, query=request.query, model=provider.embedding_model)


@router.post("/ingest")
async def ingest_entry(request: IngestRequest):
    """Manually ingest a knowledge entry."""
    if not await provider.health():
        raise HTTPException(status_code=503, detail="Ollama not reachable — cannot generate embeddings.")

    # Generate embedding from the combined text
    text_to_embed = f"{request.title}\n{request.description}\n{request.root_cause}\n{request.fix_action}"
    embedding = await provider.embed(text_to_embed)

    entry_id = f"KB-{uuid.uuid4().hex[:8]}"
    success = await knowledge.store_entry(
        entry_id=entry_id,
        title=request.title,
        category=request.category,
        description=request.description,
        root_cause=request.root_cause,
        fix_action=request.fix_action,
        severity=request.severity,
        service=request.service,
        namespace=request.namespace,
        tags=request.tags,
        embedding=embedding,
        metadata=request.metadata,
    )

    if not success:
        raise HTTPException(status_code=500, detail="Failed to store entry. Is PostgreSQL configured?")

    return {"status": "stored", "id": entry_id}


@router.post("/auto-ingest")
async def auto_ingest():
    """Auto-ingest resolved incidents from monitoring/remediation into knowledge base.
    
    Fetches current incidents, generates embeddings, and stores patterns.
    Call this periodically or after incidents are resolved.
    """
    if not await provider.health():
        raise HTTPException(status_code=503, detail="Ollama not reachable.")

    import os

    import httpx

    monitoring_url = os.getenv("MONITORING_URL", "http://localhost:8082")
    remediation_url = os.getenv("REMEDIATION_URL", "http://localhost:8084")

    ingested = 0
    errors = []

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Fetch from monitoring
        try:
            r = await client.get(f"{monitoring_url}/incidents")
            if r.status_code == 200:
                data = r.json()
                for inc in data.get("incidents", []):
                    try:
                        title = inc.get("title", "Unknown")
                        root_cause = inc.get("root_cause", "Not determined")
                        service = inc.get("service", "unknown")
                        namespace = inc.get("namespace", "default")
                        severity = inc.get("severity", "medium")
                        evidence = inc.get("evidence", [])

                        # Determine category from title
                        category = _categorize_incident(title)

                        # Generate fix suggestion
                        fix_action = _suggest_fix(category, title)

                        # Build description
                        description = f"{title}. Evidence: {', '.join(evidence[:3]) if evidence else 'none'}"

                        # Generate embedding
                        text_to_embed = f"{title}\n{description}\n{root_cause}\n{fix_action}"
                        embedding = await provider.embed(text_to_embed)

                        entry_id = f"KB-{inc.get('id', uuid.uuid4().hex[:8])}"
                        await knowledge.store_entry(
                            entry_id=entry_id,
                            title=title,
                            category=category,
                            description=description,
                            root_cause=root_cause,
                            fix_action=fix_action,
                            severity=severity,
                            service=service,
                            namespace=namespace,
                            tags=[category, severity, service],
                            embedding=embedding,
                            metadata={"source": "auto-ingest", "incident_id": inc.get("id", "")},
                        )
                        ingested += 1
                    except Exception as e:
                        errors.append(str(e))
        except Exception as e:
            errors.append(f"monitoring fetch failed: {e}")

        # Fetch from remediation (stored incidents in PostgreSQL)
        try:
            r = await client.get(f"{remediation_url}/incidents")
            if r.status_code == 200:
                data = r.json()
                for inc in data.get("incidents", []):
                    try:
                        title = inc.get("title", "Unknown")
                        root_cause = inc.get("rootCause", inc.get("root_cause", "Not determined"))
                        service = inc.get("service", "unknown")
                        namespace = inc.get("namespace", "default")
                        severity = inc.get("severity", "medium")

                        category = _categorize_incident(title)
                        fix_action = _suggest_fix(category, title)
                        description = f"{title}. Root cause: {root_cause}"

                        text_to_embed = f"{title}\n{description}\n{root_cause}\n{fix_action}"
                        embedding = await provider.embed(text_to_embed)

                        entry_id = f"KB-{inc.get('id', uuid.uuid4().hex[:8])}"
                        await knowledge.store_entry(
                            entry_id=entry_id,
                            title=title,
                            category=category,
                            description=description,
                            root_cause=root_cause,
                            fix_action=fix_action,
                            severity=severity,
                            service=service,
                            namespace=namespace,
                            tags=[category, severity, service],
                            embedding=embedding,
                            metadata={"source": "auto-ingest-remediation", "incident_id": inc.get("id", "")},
                        )
                        ingested += 1
                    except Exception as e:
                        errors.append(str(e))
        except Exception as e:
            errors.append(f"remediation fetch failed: {e}")

    return {
        "status": "complete",
        "ingested": ingested,
        "errors": errors[:5] if errors else [],
    }


@router.post("/recommend", response_model=RecommendResponse)
async def recommend_fix(request: RecommendRequest):
    """Get fix recommendations for a problem description.
    
    Combines knowledge base similarity search with LLM reasoning.
    """
    if not await provider.health():
        raise HTTPException(status_code=503, detail="Ollama not reachable.")

    # Step 1: Search knowledge base for similar incidents
    embedding = await provider.embed(request.query)
    similar = await knowledge.search_similar(embedding=embedding, limit=3, threshold=0.4)

    # Step 2: Use LLM to generate recommendation based on history
    context = "SIMILAR PAST INCIDENTS:\n"
    if similar:
        for i, entry in enumerate(similar, 1):
            context += f"\n{i}. Title: {entry['title']}\n"
            context += f"   Root Cause: {entry['root_cause']}\n"
            context += f"   Fix: {entry['fix_action']}\n"
            context += f"   Success Rate: {entry['success_rate']*100:.0f}%\n"
            context += f"   Seen {entry['occurrence_count']} times\n"
    else:
        context += "\nNo similar incidents found in knowledge base.\n"

    system = f"""You are Tagent Knowledge Engine. Based on the similar past incidents below, recommend fixes.

{context}

Respond in JSON format:
{{
  "recommendations": [
    {{
      "action": "restart-pod",
      "target": "service-name",
      "confidence": 0.85,
      "reasoning": "Based on past incident X, this fix worked 90% of the time.",
      "risk": "low"
    }}
  ]
}}"""

    prompt = f"Current problem: {request.query}"
    if request.service:
        prompt += f"\nService: {request.service}"
    if request.namespace:
        prompt += f"\nNamespace: {request.namespace}"
    prompt += "\n\nProvide fix recommendations. Respond ONLY with valid JSON."

    raw = await provider.chat(prompt=prompt, system=system)

    # Parse response
    try:
        json_str = raw.strip()
        if "```json" in json_str:
            json_str = json_str.split("```json")[1].split("```")[0].strip()
        elif "```" in json_str:
            json_str = json_str.split("```")[1].split("```")[0].strip()
        parsed = json.loads(json_str)
        recommendations = parsed.get("recommendations", [])
    except (json.JSONDecodeError, KeyError):
        recommendations = [
            {
                "action": "investigate",
                "target": request.service or "unknown",
                "confidence": 0.5,
                "reasoning": raw[:200] if raw else "LLM did not return structured recommendations.",
                "risk": "low",
            }
        ]

    # Enrich with knowledge base data
    for rec in recommendations:
        rec["similar_incidents"] = len(similar)
        rec["knowledge_base_match"] = similar[0]["title"] if similar else None

    return RecommendResponse(
        recommendations=recommendations,
        query=request.query,
        model=provider.model,
    )


@router.put("/feedback")
async def submit_feedback(request: FeedbackRequest):
    """Submit feedback on whether a recommended fix worked."""
    success = await knowledge.update_success_rate(request.entry_id, request.success)
    if not success:
        raise HTTPException(status_code=404, detail="Entry not found or database not connected.")
    return {"status": "updated", "entry_id": request.entry_id, "success": request.success}


# ===== Helpers =====

def _categorize_incident(title: str) -> str:
    """Categorize an incident based on title keywords."""
    lower = title.lower()
    if "crashloop" in lower or "crash" in lower:
        return "CrashLoopBackOff"
    if "oom" in lower or "memory" in lower:
        return "OOMKilled"
    if "notready" in lower or "not ready" in lower:
        return "NodeNotReady"
    if "latency" in lower or "slow" in lower:
        return "HighLatency"
    if "error rate" in lower or "5xx" in lower or "500" in lower:
        return "HighErrorRate"
    if "disk" in lower or "storage" in lower:
        return "DiskPressure"
    if "network" in lower or "dns" in lower or "connection" in lower:
        return "NetworkFailure"
    if "image" in lower or "pull" in lower:
        return "ImagePullBackOff"
    if "restart" in lower:
        return "HighRestarts"
    return "Other"


def _suggest_fix(category: str, title: str) -> str:
    """Suggest a fix action based on category."""
    fixes = {
        "CrashLoopBackOff": "Restart the pod (delete it so controller recreates). Check logs for application error. Review recent deployments for regressions.",
        "OOMKilled": "Increase memory limits in deployment spec. Check for memory leaks. Consider vertical pod autoscaler.",
        "NodeNotReady": "Check node conditions (disk pressure, memory pressure, PID pressure). Drain and restart kubelet if needed.",
        "HighLatency": "Check downstream dependencies. Review recent deployments. Scale up replicas if CPU-bound.",
        "HighErrorRate": "Rollback to last known good deployment. Check database connections. Review application logs.",
        "DiskPressure": "Clean up unused images and old logs. Expand PersistentVolume. Add log rotation.",
        "NetworkFailure": "Check NetworkPolicies. Verify DNS resolution. Check Service endpoints.",
        "ImagePullBackOff": "Verify image tag exists. Check registry credentials. Confirm network access to registry.",
        "HighRestarts": "Investigate container exit codes. Check resource limits. Review liveness/readiness probes.",
    }
    return fixes.get(category, "Investigate the incident details and review application logs for root cause.")
