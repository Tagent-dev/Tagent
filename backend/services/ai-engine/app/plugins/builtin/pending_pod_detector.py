"""Built-in: Pending Pod Detector

Detects pods stuck in Pending state (scheduling failure).
"""

from app.plugins.sdk import Detection, DetectorPlugin


class PendingPodDetector(DetectorPlugin):
    name = "pending-pod-detector"
    version = "1.0.0"
    description = "Detects pods stuck in Pending state indicating scheduling issues"
    author = "Tagent Core"

    def detect(self, cluster_data: dict) -> list[Detection]:
        detections = []
        for pod in cluster_data.get("pods", []):
            if pod.get("status") == "Pending":
                detections.append(Detection(
                    title=f"Pod stuck in Pending: {pod['name']}",
                    severity="high",
                    service=pod.get("name", "unknown"),
                    namespace=pod.get("namespace", "default"),
                    evidence=[
                        "Status: Pending",
                        f"Node: {pod.get('node', 'unscheduled')}",
                        f"CPU request: {pod.get('cpu_request', 'unknown')}",
                        f"Memory request: {pod.get('memory_request', 'unknown')}",
                    ],
                    recommendation="Check node capacity, resource quotas, taints/tolerations, and PodDisruptionBudgets.",
                ))
        return detections
