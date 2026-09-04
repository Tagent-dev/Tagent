"""Built-in: High Restart Detector

Detects pods with restart counts above threshold.
This is an example of how to write a DetectorPlugin.
"""

from app.plugins.sdk import Detection, DetectorPlugin


class HighRestartDetector(DetectorPlugin):
    name = "high-restart-detector"
    version = "1.0.0"
    description = "Detects pods with restart count above configurable threshold"
    author = "Tagent Core"

    def __init__(self):
        self.threshold = 5  # configurable

    def detect(self, cluster_data: dict) -> list[Detection]:
        detections = []
        for pod in cluster_data.get("pods", []):
            restarts = pod.get("restarts", 0)
            if restarts >= self.threshold:
                severity = "critical" if restarts > 20 else "high" if restarts > 10 else "medium"
                detections.append(Detection(
                    title=f"High restart count: {pod['name']} ({restarts} restarts)",
                    severity=severity,
                    service=pod.get("name", "unknown"),
                    namespace=pod.get("namespace", "default"),
                    evidence=[
                        f"Restart count: {restarts}",
                        f"Threshold: {self.threshold}",
                        f"Status: {pod.get('status', 'unknown')}",
                        f"Node: {pod.get('node', 'unknown')}",
                    ],
                    recommendation="Check pod logs for crash reason. Consider increasing resource limits or fixing the application.",
                ))
        return detections
