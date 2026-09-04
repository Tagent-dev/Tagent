"""Tagent Plugin SDK — base classes for building custom detectors.

Community developers can create plugins by:
1. Subclassing DetectorPlugin, AnalyzerPlugin, or ActionPlugin
2. Implementing the required methods
3. Placing the .py file in the plugins/ directory or registering via API

Plugin Types:
- DetectorPlugin: Scans cluster data and detects custom conditions
- AnalyzerPlugin: Analyzes incidents and provides custom insights
- ActionPlugin: Defines custom remediation actions

Example plugin:

    from app.plugins.sdk import DetectorPlugin, Detection

    class HighMemoryDetector(DetectorPlugin):
        name = "high-memory-detector"
        version = "1.0.0"
        description = "Detects pods using >90% of memory limit"

        def detect(self, cluster_data: dict) -> list[Detection]:
            detections = []
            for pod in cluster_data.get("pods", []):
                # Custom detection logic here
                if self.memory_percent(pod) > 90:
                    detections.append(Detection(
                        title=f"High memory usage: {pod['name']}",
                        severity="high",
                        service=pod.get("name", "unknown"),
                        namespace=pod.get("namespace", "default"),
                        evidence=[f"Memory at {self.memory_percent(pod)}%"],
                        recommendation="Increase memory limits or investigate leak",
                    ))
            return detections

        def memory_percent(self, pod):
            # Custom calculation
            return 95
"""

import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class Detection:
    """A single detection from a plugin."""
    title: str
    severity: str  # critical, high, medium, low
    service: str
    namespace: str
    evidence: list[str] = field(default_factory=list)
    recommendation: str = ""
    metadata: dict = field(default_factory=dict)


@dataclass
class AnalysisResult:
    """Result from an analyzer plugin."""
    summary: str
    severity: str
    confidence: float
    recommendations: list[str] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)


@dataclass
class ActionResult:
    """Result from an action plugin."""
    status: str  # success, failed, skipped, dry-run
    message: str
    metadata: dict = field(default_factory=dict)


class DetectorPlugin(ABC):
    """Base class for custom incident detectors.

    Detectors scan cluster data on every collection cycle (15s)
    and produce Detections when they find issues.
    """
    name: str = "unnamed-detector"
    version: str = "0.0.1"
    description: str = ""
    author: str = ""
    enabled: bool = True

    @abstractmethod
    def detect(self, cluster_data: dict) -> list[Detection]:
        """Scan cluster data and return any detections.

        Args:
            cluster_data: Full cluster state from Discovery service
                         (pods, nodes, deployments, services, summary)

        Returns:
            List of Detection objects for any issues found
        """

    def on_load(self):
        """Called when plugin is first loaded. Override for initialization."""

    def on_unload(self):
        """Called when plugin is unloaded. Override for cleanup."""


class AnalyzerPlugin(ABC):
    """Base class for custom incident analyzers.

    Analyzers receive incident data and provide additional insights,
    correlations, or root cause hypotheses.
    """
    name: str = "unnamed-analyzer"
    version: str = "0.0.1"
    description: str = ""
    author: str = ""
    enabled: bool = True

    @abstractmethod
    def analyze(self, incident: dict, cluster_data: dict) -> AnalysisResult:
        """Analyze an incident and return insights.

        Args:
            incident: Incident data (id, title, severity, evidence, etc.)
            cluster_data: Current cluster state

        Returns:
            AnalysisResult with summary, recommendations, etc.
        """


class ActionPlugin(ABC):
    """Base class for custom remediation actions.

    Actions define new remediation operations beyond the built-in
    restart-pod and scale-deployment.
    """
    name: str = "unnamed-action"
    version: str = "0.0.1"
    description: str = ""
    author: str = ""
    enabled: bool = True
    risk_level: str = "medium"  # low, medium, high, critical

    @abstractmethod
    def execute(self, params: dict, dry_run: bool = False) -> ActionResult:
        """Execute the custom action.

        Args:
            params: Action parameters (namespace, target, etc.)
            dry_run: If True, simulate without executing

        Returns:
            ActionResult with status and message
        """

    @abstractmethod
    def validate(self, params: dict) -> tuple[bool, str]:
        """Validate parameters before execution.

        Returns:
            (is_valid, error_message)
        """


@dataclass
class PluginInfo:
    """Metadata about a loaded plugin."""
    name: str
    version: str
    type: str  # detector, analyzer, action
    description: str
    author: str
    enabled: bool
    loaded_at: float = field(default_factory=time.time)
    detection_count: int = 0
    last_run: float | None = None
    error: str | None = None
