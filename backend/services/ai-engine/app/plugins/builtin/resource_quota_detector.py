"""Built-in: Resource Quota Detector

Detects deployments with fewer ready replicas than desired.
Shows how to inspect deployment health.
"""

from app.plugins.sdk import Detection, DetectorPlugin


class ResourceQuotaDetector(DetectorPlugin):
    name = "degraded-deployment-detector"
    version = "1.0.0"
    description = "Detects deployments with fewer ready replicas than desired"
    author = "Tagent Core"

    def detect(self, cluster_data: dict) -> list[Detection]:
        detections = []
        for dep in cluster_data.get("deployments", []):
            replicas = dep.get("replicas", 1)
            ready = dep.get("ready", 0)

            if replicas > 0 and ready < replicas:
                pct = int((ready / replicas) * 100)
                severity = "critical" if pct < 50 else "high" if pct < 80 else "medium"

                detections.append(Detection(
                    title=f"Degraded deployment: {dep['name']} ({ready}/{replicas} ready)",
                    severity=severity,
                    service=dep.get("name", "unknown"),
                    namespace=dep.get("namespace", "default"),
                    evidence=[
                        f"Desired replicas: {replicas}",
                        f"Ready replicas: {ready}",
                        f"Availability: {pct}%",
                    ],
                    recommendation="Scale up or investigate why pods are not reaching Ready state.",
                    metadata={"ready_percent": pct},
                ))
        return detections
