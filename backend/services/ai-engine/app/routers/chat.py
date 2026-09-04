"""Chat router — answers questions using real cluster data + local LLM.

Flow:
1. User asks a question
2. Check Redis cache for identical question
3. If cache miss: fetch current cluster state (pods, nodes, incidents, metrics)
4. Inject that data as context into the LLM prompt
5. LLM answers based ONLY on the real data — no hallucination
6. Cache the response in Redis (60s TTL)
7. Return the answer
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import cache as redis_cache
from app.context import fetch_cluster_context
from app.providers import OllamaProvider

router = APIRouter()
provider = OllamaProvider()

SYSTEM_PROMPT = """You are Tagent, an AI Site Reliability Engineer for Kubernetes clusters.

RULES:
1. Answer ONLY based on the CLUSTER DATA provided below. Never guess or make up data.
2. If the data doesn't contain the answer, say "I don't have that information in the current cluster data."
3. Be concise and technical. Use exact numbers from the data.
4. When suggesting fixes, explain the risk level and what will happen.
5. Format numbers clearly. Use bullet points for lists.
6. If asked about pods, nodes, CPU, memory — give exact values from the data.
7. If something is failing, explain WHY based on the evidence in the data.

CLUSTER DATA:
{context}
"""


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    response: str
    model: str
    context_source: str


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Answer a question about the cluster using real data + local LLM."""

    # Check if Ollama is reachable
    if not await provider.health():
        raise HTTPException(
            status_code=503,
            detail="Local LLM (Ollama) is not reachable. Make sure Ollama is running."
        )

    # Fetch real cluster data (with Redis cache — 15s TTL)
    context = await redis_cache.get_cached_context()
    if not context:
        context = await fetch_cluster_context()
        await redis_cache.set_cached_context(context, ttl=15)

    # Build the full prompt with real data injected
    system = SYSTEM_PROMPT.format(context=context)
    prompt = request.message

    # Check Redis cache for identical question
    cached = await redis_cache.get_cached_chat(prompt, system)
    if cached:
        return ChatResponse(
            response=cached,
            model=provider.model,
            context_source="cached",
        )

    # Ask the local LLM
    answer = await provider.chat(prompt=prompt, system=system)

    # Cache the response (60 second TTL)
    await redis_cache.set_cached_chat(prompt, system, answer, ttl=60)

    return ChatResponse(
        response=answer,
        model=provider.model,
        context_source="live" if "live scan" in context else "no-data",
    )
