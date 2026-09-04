"""Provider interface for local LLM runtimes."""

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator


class LLMProvider(ABC):
    """Abstract interface every local LLM provider must implement."""

    @abstractmethod
    async def chat(self, prompt: str, system: str | None = None) -> str:
        """Single-shot completion."""

    @abstractmethod
    async def chat_stream(self, prompt: str, system: str | None = None) -> AsyncIterator[str]:
        """Token-by-token streaming completion."""

    @abstractmethod
    async def embed(self, text: str) -> list[float]:
        """Vector embedding for similarity search / incident memory."""

    @abstractmethod
    async def health(self) -> bool:
        """Returns True if the local runtime is reachable and the model is loaded."""
