"""Unit tests for the AI Engine's provider, cache, and plugin seams."""

from unittest.mock import AsyncMock, Mock

import pytest

from app import cache
from app.plugins.manager import PluginManager
from app.plugins.sdk import Detection, DetectorPlugin
from app.providers.ollama_provider import OllamaProvider


class FakeResponse:
    def __init__(self, payload=None, status_code=200):
        self._payload = payload or {}
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError("request failed")

    def json(self):
        return self._payload


class FakeStream:
    def __init__(self, lines):
        self.lines = lines

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    def raise_for_status(self):
        return None

    async def aiter_lines(self):
        for line in self.lines:
            yield line


@pytest.mark.asyncio
async def test_ollama_chat_posts_non_streaming_payload():
    provider = OllamaProvider(endpoint="http://ollama", model="test-model")
    provider._client.post = AsyncMock(return_value=FakeResponse({"response": "ok"}))

    assert await provider.chat("hello", system="be concise") == "ok"
    provider._client.post.assert_awaited_once_with(
        "http://ollama/api/generate",
        json={
            "model": "test-model",
            "prompt": "hello",
            "stream": False,
            "system": "be concise",
        },
    )


@pytest.mark.asyncio
async def test_ollama_chat_omits_empty_system_prompt():
    provider = OllamaProvider(endpoint="http://ollama")
    provider._client.post = AsyncMock(return_value=FakeResponse({"response": "ok"}))

    await provider.chat("hello", system="")
    assert "system" not in provider._client.post.call_args.kwargs["json"]


@pytest.mark.asyncio
async def test_ollama_stream_yields_valid_response_chunks_only():
    provider = OllamaProvider(endpoint="http://ollama")
    provider._client.stream = Mock(
        return_value=FakeStream(
            ['{"response":"a"}', "not-json", '{"done":true}', '{"response":"b"}']
        )
    )

    chunks = [chunk async for chunk in provider.chat_stream("hello")]

    assert chunks == ["a", "b"]


@pytest.mark.asyncio
async def test_ollama_embed_uses_configured_embedding_model():
    provider = OllamaProvider(endpoint="http://ollama", embedding_model="embed-model")
    provider._client.post = AsyncMock(
        return_value=FakeResponse({"embedding": [1.0, 2.0]})
    )

    assert await provider.embed("document") == [1.0, 2.0]
    provider._client.post.assert_awaited_once_with(
        "http://ollama/api/embeddings",
        json={"model": "embed-model", "prompt": "document"},
    )


@pytest.mark.asyncio
async def test_ollama_health_reports_success():
    provider = OllamaProvider(endpoint="http://ollama")
    provider._client.get = AsyncMock(return_value=FakeResponse(status_code=200))

    assert await provider.health() is True


@pytest.mark.asyncio
async def test_ollama_health_reports_transport_failure():
    provider = OllamaProvider(endpoint="http://ollama")
    provider._client.get = AsyncMock(side_effect=RuntimeError("offline"))

    assert await provider.health() is False


class AlwaysDetect(DetectorPlugin):
    name = "always-detect"
    version = "1.0.0"

    def detect(self, cluster_data):
        return [Detection("Found issue", "high", "api", "default")]


def test_detector_plugin_returns_typed_detection():
    detections = AlwaysDetect().detect({"pods": []})

    assert detections[0].title == "Found issue"
    assert detections[0].severity == "high"


def test_plugin_manager_registers_and_unloads_detector():
    manager = PluginManager.__new__(PluginManager)
    manager.detectors = {}
    manager.analyzers = {}
    manager.actions = {}
    manager.info = {}
    manager.detections = []

    manager.register_detector(AlwaysDetect(), source="test")

    assert manager.info["always-detect"].type == "detector"
    assert manager.unload_plugin("always-detect") is True
    assert manager.unload_plugin("missing") is False


@pytest.mark.asyncio
async def test_chat_cache_reads_using_hashed_key(monkeypatch):
    client = Mock()
    client.get = AsyncMock(return_value="cached")
    monkeypatch.setattr(cache, "get_client", AsyncMock(return_value=client))

    assert await cache.get_cached_chat("prompt", "system") == "cached"
    client.get.assert_awaited_once_with(cache._hash_key("chat", "system|prompt"))


@pytest.mark.asyncio
async def test_embedding_cache_serializes_and_deserializes_vectors(monkeypatch):
    client = Mock()
    client.get = AsyncMock(return_value="[0.1, 0.2]")
    client.setex = AsyncMock()
    monkeypatch.setattr(cache, "get_client", AsyncMock(return_value=client))

    assert await cache.get_cached_embedding("text") == [0.1, 0.2]
    await cache.set_cached_embedding("text", [0.1, 0.2], ttl=30)
    client.setex.assert_awaited_once_with(
        cache._hash_key("embed", "text"), 30, "[0.1, 0.2]"
    )
