"""Model Management Router — install, list, switch, and manage AI models.

Local-first with optional cloud (BYOK). Local models run via Ollama
(pull/delete/switch). Users may also add a cloud provider API key (OpenAI,
Gemini, Anthropic, ...) which is stored as a Kubernetes Secret and used to route
LLM calls through that provider. See doc/AI_MODELS_BYOK_SPEC.md.
"""

import asyncio
import base64
import json
import os

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

OLLAMA_ENDPOINT = os.getenv("OLLAMA_ENDPOINT", "http://localhost:11434")
NAMESPACE = os.getenv("TAGENT_NAMESPACE", "tagent")

# ===== Available Model Catalog =====

LOCAL_MODELS_CATALOG = [
    # Small models (< 4GB) — fast, good for simple tasks
    {"id": "llama3.2:1b", "name": "Llama 3.2 1B", "size": "1.3GB", "category": "small", "description": "Ultra-fast, basic reasoning and chat", "provider": "ollama", "default": True},
    {"id": "llama3.2:3b", "name": "Llama 3.2 3B", "size": "2.0GB", "category": "small", "description": "Fast inference, good for summarization", "provider": "ollama"},
    {"id": "phi3:mini", "name": "Phi-3 Mini (3.8B)", "size": "2.3GB", "category": "small", "description": "Microsoft's compact reasoning model", "provider": "ollama"},
    {"id": "gemma2:2b", "name": "Gemma 2 2B", "size": "1.6GB", "category": "small", "description": "Google's efficient small model", "provider": "ollama"},
    {"id": "qwen2.5:3b", "name": "Qwen 2.5 3B", "size": "1.9GB", "category": "small", "description": "Alibaba's multilingual small model", "provider": "ollama"},

    # Medium models (4-10GB) — balanced performance
    {"id": "llama3.1:8b", "name": "Llama 3.1 8B", "size": "4.7GB", "category": "medium", "description": "Great balance of speed and intelligence", "provider": "ollama"},
    {"id": "mistral:7b", "name": "Mistral 7B", "size": "4.1GB", "category": "medium", "description": "Fast, strong at code and reasoning", "provider": "ollama"},
    {"id": "gemma2:9b", "name": "Gemma 2 9B", "size": "5.4GB", "category": "medium", "description": "Google's mid-range model, strong at analysis", "provider": "ollama"},
    {"id": "qwen2.5:7b", "name": "Qwen 2.5 7B", "size": "4.4GB", "category": "medium", "description": "Strong multilingual and coding capabilities", "provider": "ollama"},
    {"id": "deepseek-coder:6.7b", "name": "DeepSeek Coder 6.7B", "size": "3.8GB", "category": "medium", "description": "Optimized for code generation and analysis", "provider": "ollama"},
    {"id": "phi3:medium", "name": "Phi-3 Medium (14B)", "size": "7.9GB", "category": "medium", "description": "Strong reasoning, fits in 16GB RAM", "provider": "ollama"},

    # Large models (10GB+) — maximum capability
    {"id": "llama3.1:70b", "name": "Llama 3.1 70B", "size": "40GB", "category": "large", "description": "Near GPT-4 quality, requires 48GB+ RAM", "provider": "ollama"},
    {"id": "qwen2.5:72b", "name": "Qwen 2.5 72B", "size": "41GB", "category": "large", "description": "Top-tier open model, rivals GPT-4", "provider": "ollama"},
    {"id": "deepseek-coder:33b", "name": "DeepSeek Coder 33B", "size": "19GB", "category": "large", "description": "Best open-source coding model", "provider": "ollama"},
    {"id": "mixtral:8x7b", "name": "Mixtral 8x7B", "size": "26GB", "category": "large", "description": "MoE architecture, fast for its quality", "provider": "ollama"},
    {"id": "codellama:70b", "name": "Code Llama 70B", "size": "38GB", "category": "large", "description": "Meta's largest code-focused model", "provider": "ollama"},

    # Embedding models
    {"id": "nomic-embed-text", "name": "Nomic Embed Text", "size": "274MB", "category": "embedding", "description": "Default embedding model for vector search", "provider": "ollama", "default": True},
    {"id": "mxbai-embed-large", "name": "MXBai Embed Large", "size": "670MB", "category": "embedding", "description": "High quality embeddings, better retrieval", "provider": "ollama"},
    {"id": "all-minilm", "name": "All-MiniLM-L6", "size": "45MB", "category": "embedding", "description": "Tiny, fast, good enough for most tasks", "provider": "ollama"},
]

# ===== Cloud Providers (optional, user-supplied API keys) =====

CLOUD_PROVIDERS = [
    {"id": "openai", "name": "OpenAI (GPT)", "models": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"], "key_env": "OPENAI_API_KEY"},
    {"id": "anthropic", "name": "Anthropic (Claude)", "models": ["claude-sonnet-4-20250514", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"], "key_env": "ANTHROPIC_API_KEY"},
    {"id": "google", "name": "Google (Gemini)", "models": ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"], "key_env": "GOOGLE_API_KEY"},
    {"id": "groq", "name": "Groq (Fast Inference)", "models": ["llama-3.1-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"], "key_env": "GROQ_API_KEY"},
    {"id": "together", "name": "Together AI", "models": ["meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo", "mistralai/Mixtral-8x7B-Instruct-v0.1"], "key_env": "TOGETHER_API_KEY"},
]

# ===== Pydantic Models =====

class PullModelRequest(BaseModel):
    model_id: str

class SwitchModelRequest(BaseModel):
    model_id: str
    model_type: str = "chat"  # "chat" or "embedding"

class CloudKeyRequest(BaseModel):
    provider_id: str
    api_key: str

class DeleteModelRequest(BaseModel):
    model_id: str


# ===== In-memory pull tracking =====
_pull_tasks: dict[str, dict] = {}


# ===== Helper: Ollama API =====

async def _ollama_get(path: str):
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(f"{OLLAMA_ENDPOINT}{path}")
        r.raise_for_status()
        return r.json()


async def _ollama_post(path: str, payload: dict):
    async with httpx.AsyncClient(timeout=300.0) as client:
        r = await client.post(f"{OLLAMA_ENDPOINT}{path}", json=payload)
        r.raise_for_status()
        return r.json()


async def _ollama_delete(path: str, payload: dict):
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.request("DELETE", f"{OLLAMA_ENDPOINT}{path}", json=payload)
        r.raise_for_status()
        return r.json()


# ===== Helper: K8s Secrets (for cloud API keys) =====

async def _k8s_store_secret(provider_id: str, api_key: str) -> bool:
    """Store a cloud API key in a Kubernetes Secret (create or update)."""
    secret_name = f"tagent-llm-{provider_id}"
    try:
        proc = await asyncio.create_subprocess_exec(
            "kubectl", "create", "secret", "generic", secret_name,
            f"--from-literal=api-key={api_key}",
            "-n", NAMESPACE,
            "--dry-run=client", "-o", "yaml",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        yaml_out, _ = await proc.communicate()

        proc2 = await asyncio.create_subprocess_exec(
            "kubectl", "apply", "-f", "-",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await proc2.communicate(input=yaml_out)
        return proc2.returncode == 0
    except Exception:
        return False


async def _k8s_get_secret(provider_id: str) -> str | None:
    """Read a cloud API key from its Kubernetes Secret."""
    secret_name = f"tagent-llm-{provider_id}"
    try:
        proc = await asyncio.create_subprocess_exec(
            "kubectl", "get", "secret", secret_name,
            "-n", NAMESPACE,
            "-o", "jsonpath={.data.api-key}",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        out, _ = await proc.communicate()
        if proc.returncode != 0 or not out:
            return None
        return base64.b64decode(out).decode("utf-8")
    except Exception:
        return None


async def _k8s_delete_secret(provider_id: str) -> bool:
    """Delete a cloud API key Secret from Kubernetes."""
    secret_name = f"tagent-llm-{provider_id}"
    try:
        proc = await asyncio.create_subprocess_exec(
            "kubectl", "delete", "secret", secret_name,
            "-n", NAMESPACE, "--ignore-not-found",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await proc.communicate()
        return proc.returncode == 0
    except Exception:
        return False


async def _k8s_list_secrets() -> list[str]:
    """List provider ids that have a stored key (tagent-llm-* secrets)."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "kubectl", "get", "secrets",
            "-n", NAMESPACE,
            "-o", "jsonpath={.items[*].metadata.name}",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        out, _ = await proc.communicate()
        if proc.returncode != 0:
            return []
        names = out.decode("utf-8").split()
        return [n.replace("tagent-llm-", "") for n in names if n.startswith("tagent-llm-")]
    except Exception:
        return []


# ===== Background pull task =====

async def _pull_model_background(model_id: str):
    """Pull model from Ollama registry in background."""
    _pull_tasks[model_id] = {"status": "pulling", "progress": 0, "error": None}
    try:
        async with httpx.AsyncClient(timeout=3600.0) as client:
            async with client.stream("POST", f"{OLLAMA_ENDPOINT}/api/pull", json={"name": model_id, "stream": True}) as r:
                r.raise_for_status()
                async for line in r.aiter_lines():
                    if not line:
                        continue
                    try:
                        chunk = json.loads(line)
                        if "total" in chunk and "completed" in chunk:
                            total = chunk["total"]
                            completed = chunk["completed"]
                            if total > 0:
                                _pull_tasks[model_id]["progress"] = int((completed / total) * 100)
                        if chunk.get("status") == "success":
                            _pull_tasks[model_id] = {"status": "ready", "progress": 100, "error": None}
                            return
                    except json.JSONDecodeError:
                        continue
        _pull_tasks[model_id] = {"status": "ready", "progress": 100, "error": None}
    except Exception as e:
        _pull_tasks[model_id] = {"status": "error", "progress": 0, "error": str(e)}


# ===== Endpoints =====

@router.get("/catalog")
async def get_model_catalog():
    """Return full catalog of available local models + cloud providers."""
    return {
        "local_models": LOCAL_MODELS_CATALOG,
        "cloud_providers": CLOUD_PROVIDERS,
    }


@router.get("/installed")
async def get_installed_models():
    """List models currently installed in Ollama."""
    try:
        data = await _ollama_get("/api/tags")
        models = data.get("models", [])
        installed = []
        for m in models:
            installed.append({
                "id": m.get("name", ""),
                "size": m.get("size", 0),
                "size_human": _format_bytes(m.get("size", 0)),
                "modified_at": m.get("modified_at", ""),
                "family": m.get("details", {}).get("family", ""),
                "parameter_size": m.get("details", {}).get("parameter_size", ""),
                "quantization": m.get("details", {}).get("quantization_level", ""),
            })
        return {"models": installed, "total": len(installed)}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Cannot reach Ollama: {e!s}")


@router.get("/active")
async def get_active_model():
    """Return the currently active chat and embedding models."""
    return {
        "chat_model": os.getenv("OLLAMA_MODEL", "llama3.1:8b"),
        "embedding_model": os.getenv("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text"),
        "endpoint": OLLAMA_ENDPOINT,
    }


@router.post("/pull")
async def pull_model(req: PullModelRequest):
    """Start pulling/installing a model from Ollama registry (background)."""
    model_id = req.model_id

    # Check if already pulling
    if model_id in _pull_tasks and _pull_tasks[model_id]["status"] == "pulling":
        return {"status": "already_pulling", "model_id": model_id, "progress": _pull_tasks[model_id]["progress"]}

    # Start background pull
    asyncio.create_task(_pull_model_background(model_id))
    return {"status": "pulling", "model_id": model_id, "message": f"Started pulling {model_id}"}


@router.get("/pull/status/{model_id:path}")
async def get_pull_status(model_id: str):
    """Check the pull progress for a model."""
    if model_id in _pull_tasks:
        return {"model_id": model_id, **_pull_tasks[model_id]}
    return {"model_id": model_id, "status": "unknown", "progress": 0, "error": None}


@router.post("/switch")
async def switch_active_model(req: SwitchModelRequest):
    """Switch the active model (updates env vars at runtime)."""
    if req.model_type == "chat":
        os.environ["OLLAMA_MODEL"] = req.model_id
    elif req.model_type == "embedding":
        os.environ["OLLAMA_EMBEDDING_MODEL"] = req.model_id
    else:
        raise HTTPException(status_code=400, detail="model_type must be 'chat' or 'embedding'")

    return {
        "status": "switched",
        "model_type": req.model_type,
        "model_id": req.model_id,
        "message": f"Active {req.model_type} model switched to {req.model_id}",
    }


@router.post("/delete")
async def delete_model(req: DeleteModelRequest):
    """Delete a model from Ollama."""
    try:
        await _ollama_delete("/api/delete", {"name": req.model_id})
        # Clean up pull tracking
        _pull_tasks.pop(req.model_id, None)
        return {"status": "deleted", "model_id": req.model_id}
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Failed to delete: {e!s}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===== Cloud API Key Management (optional, BYOK) =====

@router.post("/cloud/key")
async def store_cloud_key(req: CloudKeyRequest):
    """Store a cloud provider API key in a Kubernetes Secret."""
    provider = next((p for p in CLOUD_PROVIDERS if p["id"] == req.provider_id), None)
    if not provider:
        raise HTTPException(status_code=404, detail=f"Unknown provider: {req.provider_id}")

    success = await _k8s_store_secret(req.provider_id, req.api_key)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to store secret in cluster")

    return {
        "status": "stored",
        "provider": req.provider_id,
        "message": f"API key for {provider['name']} stored securely in cluster secret",
    }


@router.get("/cloud/keys")
async def list_cloud_keys():
    """List which cloud providers have a key stored (never the keys themselves)."""
    stored = await _k8s_list_secrets()
    providers_with_keys = []
    for p in CLOUD_PROVIDERS:
        providers_with_keys.append({
            "id": p["id"],
            "name": p["name"],
            "has_key": p["id"] in stored,
            "models": p["models"],
        })
    return {"providers": providers_with_keys}


@router.delete("/cloud/key/{provider_id}")
async def delete_cloud_key(provider_id: str):
    """Remove a cloud provider API key Secret (falls back to local Ollama)."""
    success = await _k8s_delete_secret(provider_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete secret")
    return {"status": "deleted", "provider": provider_id}


# ===== Helpers =====

def _format_bytes(size_bytes: int) -> str:
    if size_bytes == 0:
        return "0B"
    units = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    size = float(size_bytes)
    while size >= 1024 and i < len(units) - 1:
        size /= 1024
        i += 1
    return f"{size:.1f}{units[i]}"
