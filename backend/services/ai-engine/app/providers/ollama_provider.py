"""Ollama provider — default local LLM runtime for Tagent."""

import json
import os
from collections.abc import AsyncIterator

import httpx

from app.providers.base import LLMProvider


class OllamaProvider(LLMProvider):
    def __init__(
        self,
        endpoint: str | None = None,
        model: str | None = None,
        embedding_model: str | None = None,
    ):
        self.endpoint = (endpoint or os.getenv("OLLAMA_ENDPOINT", "http://localhost:11434")).rstrip("/")
        self.model = model or os.getenv("OLLAMA_MODEL", "llama3.2:1b")
        self.embedding_model = embedding_model or os.getenv("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text")
        self._client = httpx.AsyncClient(timeout=120.0)

    async def chat(self, prompt: str, system: str | None = None) -> str:
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
        }
        if system:
            payload["system"] = system
        r = await self._client.post(f"{self.endpoint}/api/generate", json=payload)
        r.raise_for_status()
        return r.json().get("response", "")

    async def chat_stream(self, prompt: str, system: str | None = None) -> AsyncIterator[str]:
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": True,
        }
        if system:
            payload["system"] = system
        async with self._client.stream("POST", f"{self.endpoint}/api/generate", json=payload) as r:
            r.raise_for_status()
            async for line in r.aiter_lines():
                if not line:
                    continue
                try:
                    chunk = json.loads(line)
                    if "response" in chunk:
                        yield chunk["response"]
                except json.JSONDecodeError:
                    continue

    async def embed(self, text: str) -> list[float]:
        payload = {"model": self.embedding_model, "prompt": text}
        r = await self._client.post(f"{self.endpoint}/api/embeddings", json=payload)
        r.raise_for_status()
        return r.json().get("embedding", [])

    async def health(self) -> bool:
        try:
            r = await self._client.get(f"{self.endpoint}/api/tags", timeout=5.0)
            return r.status_code == 200
        except Exception:
            return False
