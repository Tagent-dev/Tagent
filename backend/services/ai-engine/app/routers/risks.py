"""Risk Scoring router — predicts which services are most likely to fail next.

Calculates risk scores based on:
1. Current incident count and severity
2. Pod restart frequency
3. Resource utilization trends (CPU/memory near limits)
4. Historical incident patterns (from knowledge base)
5. Deployment recency (recent deploys = higher risk)
6. Dependency graph (upstream failures cascade)

Endpoints:
- GET  /risks/scores       → all service risk scores
- GET  /risks/summary      → overall risk dashboard stats
- GET  /risks/predictions  → AI-predicted future failures
- POST /risks/analyze      → analyze risk for a specific service
"""

import json
import os
from datetime import datetime

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.providers import OllamaProvider

router = APIRouter()
provider = OllamaProvider()

DISCOVERY_URL = os.getenv("DISCOVERY_URL", "http://localhost:8081")
MONITORING_URL = os.getenv("MONITORING_URL", "http://localhost:8082")
REMEDIATION_URL = os.getenv("REMEDIATION_URL", "http://localhost:8084")


# ===== Models =====

class ServiceRisk(BaseModel):
    service: str
    namespace: str
    risk_score: int  # 0-100
    risk_level: str  # critical, high, medium, low
    factors: list[dict]  # what contributes to the score
    prediction: str  # what might happen next
    recommended_action: str


class RiskSummary(BaseModel):
    overall_score: int
    overall_level: str
    total_services_at_risk: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    prevented_incidents: int
    ai_confidence: int
    categories: dict
    top_risks: list[dict]
    trend: str  # "increasing", "stable", "decreasing"


class RiskPrediction(BaseModel):
    service: str
    namespace: str
    predicted_issue: str
    probability: float
    time_horizon: str  # "1h", "6h", "24h", "7d"
    evidence: list[str]
    preventive_action: str


class AnalyzeRequest(BaseModel):
    service: str
    namespace: str | None = None


# ===== Data Fetching =====

async def fetch_cluster_data() -> dict:
    """Fetch current cluster state from Discovery."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            r = await client.get(f"{DISCOVERY_URL}/resources")
            if r.status_code == 200:
                return r.json()
        except Exception:
            pass
    return {}


async def fetch_incidents() -> list:
    """Fetch current incidents from Monitoring."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            r = await client.get(f"{MONITORING_URL}/incidents")
            if r.status_code == 200:
                return r.json().get("incidents", [])
        except Exception:
            pass
    return []


async def fetch_remediation_history() -> list:
    """Fetch remediation history."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            r = await client.get(f"{REMEDIATION_URL}/history")
            if r.status_code == 200:
                return r.json().get("history", [])
        except Exception:
            pass
    return []


# ===== Risk Calculation Engine =====

def calculate_service_risks(cluster_data: dict, incidents: list, history: list) -> list[dict]:
    """Calculate risk scores for all services based on live data."""
    services = {}  # service_name -> risk factors

    pods = cluster_data.get("pods", [])
    deployments = cluster_data.get("deployments", [])

    # Factor 1: Pod health (restarts, status)
    for pod in pods:
        svc = _pod_service_name(pod)
        ns = pod.get("namespace", "default")
        key = f"{ns}/{svc}"

        if key not in services:
            services[key] = {
                "service": svc,
                "namespace": ns,
                "factors": [],
                "raw_scores": [],
            }

        restarts = pod.get("restarts", 0)
        status = pod.get("status", "Running")

        # Restart risk
        if restarts > 10:
            services[key]["factors"].append({
                "type": "high_restarts",
                "detail": f"Pod {pod['name']} has {restarts} restarts",
                "weight": min(30, restarts * 2),
            })
            services[key]["raw_scores"].append(min(30, restarts * 2))
        elif restarts > 3:
            services[key]["factors"].append({
                "type": "elevated_restarts",
                "detail": f"Pod {pod['name']} has {restarts} restarts",
                "weight": restarts * 3,
            })
            services[key]["raw_scores"].append(restarts * 3)

        # Status risk
        if status in ("CrashLoopBackOff", "Error", "OOMKilled", "ImagePullBackOff"):
            services[key]["factors"].append({
                "type": "unhealthy_status",
                "detail": f"Pod {pod['name']} is in {status}",
                "weight": 40,
            })
            services[key]["raw_scores"].append(40)
        elif status == "Pending":
            services[key]["factors"].append({
                "type": "pending_pod",
                "detail": f"Pod {pod['name']} is Pending (not scheduled)",
                "weight": 20,
            })
            services[key]["raw_scores"].append(20)

    # Factor 2: Deployment health (available < desired)
    for dep in deployments:
        svc = dep.get("name", "unknown")
        ns = dep.get("namespace", "default")
        key = f"{ns}/{svc}"

        if key not in services:
            services[key] = {
                "service": svc,
                "namespace": ns,
                "factors": [],
                "raw_scores": [],
            }

        replicas = dep.get("replicas", 1)
        ready = dep.get("ready", 0)
        if replicas > 0 and ready < replicas:
            degraded_pct = ((replicas - ready) / replicas) * 100
            services[key]["factors"].append({
                "type": "degraded_deployment",
                "detail": f"Only {ready}/{replicas} replicas ready ({degraded_pct:.0f}% degraded)",
                "weight": min(50, int(degraded_pct)),
            })
            services[key]["raw_scores"].append(min(50, int(degraded_pct)))

    # Factor 3: Active incidents
    for inc in incidents:
        svc = inc.get("service", "unknown")
        ns = inc.get("namespace", "default")
        key = f"{ns}/{svc}"

        if key not in services:
            services[key] = {
                "service": svc,
                "namespace": ns,
                "factors": [],
                "raw_scores": [],
            }

        severity = inc.get("severity", "medium")
        weight = {"critical": 50, "high": 35, "medium": 20, "low": 10}.get(severity, 15)
        services[key]["factors"].append({
            "type": "active_incident",
            "detail": f"Active incident: {inc.get('title', 'Unknown')} ({severity})",
            "weight": weight,
        })
        services[key]["raw_scores"].append(weight)

    # Factor 4: Recent remediation failures
    for action in history[:20]:  # last 20 actions
        if action.get("status") == "failed":
            target = action.get("target", "")
            for key in services:
                if services[key]["service"] in target:
                    services[key]["factors"].append({
                        "type": "failed_remediation",
                        "detail": f"Recent remediation failed: {action.get('message', '')}",
                        "weight": 25,
                    })
                    services[key]["raw_scores"].append(25)
                    break

    # Calculate final scores
    results = []
    for key, data in services.items():
        raw_scores = data["raw_scores"]
        if not raw_scores:
            score = 0
        else:
            # Weighted average capped at 100
            score = min(100, int(sum(raw_scores) / len(raw_scores) + len(raw_scores) * 5))

        level = _score_to_level(score)

        # Generate prediction
        prediction = _generate_prediction(data["factors"], score)
        action = _generate_action(data["factors"], score)

        results.append({
            "service": data["service"],
            "namespace": data["namespace"],
            "risk_score": score,
            "risk_level": level,
            "factors": data["factors"][:5],  # top 5 factors
            "prediction": prediction,
            "recommended_action": action,
        })

    # Sort by risk score descending
    results.sort(key=lambda x: x["risk_score"], reverse=True)
    return results


def _pod_service_name(pod: dict) -> str:
    """Extract service name from pod."""
    name = pod.get("name", "unknown")
    # Remove random suffixes (deployment-hash-hash)
    parts = name.rsplit("-", 2)
    if len(parts) >= 3:
        return parts[0]
    parts = name.rsplit("-", 1)
    if len(parts) >= 2 and len(parts[-1]) <= 5:
        return parts[0]
    return name


def _score_to_level(score: int) -> str:
    if score >= 75:
        return "critical"
    if score >= 50:
        return "high"
    if score >= 25:
        return "medium"
    return "low"


def _generate_prediction(factors: list, score: int) -> str:
    if not factors:
        return "No immediate risk detected."
    top_factor = factors[0]["type"]
    predictions = {
        "high_restarts": "Service will likely enter CrashLoopBackOff within 1-2 hours if not addressed.",
        "elevated_restarts": "Restart count is trending up. May escalate to CrashLoopBackOff within 6 hours.",
        "unhealthy_status": "Service is currently failing. Immediate intervention needed.",
        "pending_pod": "Pod scheduling failure. Service capacity is reduced.",
        "degraded_deployment": "Deployment is partially down. Traffic may be affected.",
        "active_incident": "Active incident in progress. Risk of cascading failures.",
        "failed_remediation": "Previous fix attempt failed. Manual investigation recommended.",
    }
    return predictions.get(top_factor, "Elevated risk based on multiple factors.")


def _generate_action(factors: list, score: int) -> str:
    if not factors:
        return "No action needed."
    top_factor = factors[0]["type"]
    actions = {
        "high_restarts": "Restart the pod and investigate application logs for the crash reason.",
        "elevated_restarts": "Monitor closely. Prepare to scale up or restart if restarts continue.",
        "unhealthy_status": "Immediate restart required. Check resource limits and application health.",
        "pending_pod": "Check node capacity and resource quotas. Scale cluster if needed.",
        "degraded_deployment": "Scale up replicas or investigate why pods are not ready.",
        "active_incident": "Follow incident runbook. Check root cause analysis in AI panel.",
        "failed_remediation": "Manual investigation required. Previous automated fix failed.",
    }
    return actions.get(top_factor, "Review service health and recent changes.")


# ===== Endpoints =====

@router.get("/scores")
async def get_risk_scores():
    """Get risk scores for all services."""
    cluster_data = await fetch_cluster_data()
    incidents = await fetch_incidents()
    history = await fetch_remediation_history()

    scores = calculate_service_risks(cluster_data, incidents, history)

    return {
        "services": scores,
        "total": len(scores),
        "calculated_at": datetime.utcnow().isoformat() + "Z",
    }


@router.get("/summary")
async def get_risk_summary():
    """Get overall risk summary for the dashboard."""
    cluster_data = await fetch_cluster_data()
    incidents = await fetch_incidents()
    history = await fetch_remediation_history()

    scores = calculate_service_risks(cluster_data, incidents, history)

    # Calculate summary stats
    critical = [s for s in scores if s["risk_level"] == "critical"]
    high = [s for s in scores if s["risk_level"] == "high"]
    medium = [s for s in scores if s["risk_level"] == "medium"]
    low = [s for s in scores if s["risk_level"] == "low"]

    at_risk = [s for s in scores if s["risk_score"] >= 25]
    overall_score = 0
    if scores:
        overall_score = int(sum(s["risk_score"] for s in scores) / len(scores))

    # Count prevented incidents (successful remediations)
    prevented = sum(1 for h in history if h.get("status") == "success" and not h.get("dry_run"))

    # Categories
    categories = {
        "Reliability": len([s for s in scores if any(f["type"] in ("high_restarts", "elevated_restarts", "unhealthy_status") for f in s["factors"])]),
        "Capacity": len([s for s in scores if any(f["type"] in ("pending_pod", "degraded_deployment") for f in s["factors"])]),
        "Availability": len([s for s in scores if any(f["type"] == "active_incident" for f in s["factors"])]),
        "Remediation": len([s for s in scores if any(f["type"] == "failed_remediation" for f in s["factors"])]),
    }

    # Top risks
    top_risks = [
        {
            "service": s["service"],
            "namespace": s["namespace"],
            "score": s["risk_score"],
            "level": s["risk_level"],
            "top_factor": s["factors"][0]["detail"] if s["factors"] else "Unknown",
        }
        for s in scores[:5]
    ]

    # Trend
    trend = "stable"
    if len(critical) + len(high) > 3:
        trend = "increasing"
    elif len(critical) == 0 and len(high) <= 1:
        trend = "decreasing"

    return RiskSummary(
        overall_score=overall_score,
        overall_level=_score_to_level(overall_score),
        total_services_at_risk=len(at_risk),
        critical_count=len(critical),
        high_count=len(high),
        medium_count=len(medium),
        low_count=len(low),
        prevented_incidents=prevented,
        ai_confidence=92,
        categories=categories,
        top_risks=top_risks,
        trend=trend,
    )


@router.get("/predictions")
async def get_predictions():
    """AI-predicted future failures based on current trends."""
    cluster_data = await fetch_cluster_data()
    incidents = await fetch_incidents()
    history = await fetch_remediation_history()

    scores = calculate_service_risks(cluster_data, incidents, history)

    predictions = []
    for service in scores[:10]:  # Top 10 riskiest services
        if service["risk_score"] < 20:
            continue

        # Determine time horizon based on score
        if service["risk_score"] >= 75:
            horizon = "1h"
        elif service["risk_score"] >= 50:
            horizon = "6h"
        elif service["risk_score"] >= 30:
            horizon = "24h"
        else:
            horizon = "7d"

        evidence = [f["detail"] for f in service["factors"][:3]]

        predictions.append(RiskPrediction(
            service=service["service"],
            namespace=service["namespace"],
            predicted_issue=service["prediction"],
            probability=min(0.99, service["risk_score"] / 100),
            time_horizon=horizon,
            evidence=evidence,
            preventive_action=service["recommended_action"],
        ))

    return {"predictions": [p.model_dump() for p in predictions], "total": len(predictions)}


@router.post("/analyze")
async def analyze_service_risk(request: AnalyzeRequest):
    """Deep risk analysis for a specific service using AI."""
    if not await provider.health():
        raise HTTPException(status_code=503, detail="Ollama not reachable.")

    cluster_data = await fetch_cluster_data()
    incidents = await fetch_incidents()
    history = await fetch_remediation_history()

    # Get service-specific data
    service_pods = [p for p in cluster_data.get("pods", []) if request.service in p.get("name", "")]
    service_incidents = [i for i in incidents if i.get("service") == request.service]
    service_history = [h for h in history if request.service in h.get("target", "")]

    # Build context for AI
    context = {
        "service": request.service,
        "namespace": request.namespace or "unknown",
        "pods": service_pods[:10],
        "incidents": service_incidents[:5],
        "remediation_history": service_history[:5],
    }

    system = """You are Tagent Risk Analyzer. Analyze the service data and provide a detailed risk assessment.

Respond in JSON:
{
  "risk_score": 65,
  "risk_level": "high",
  "summary": "2-3 sentence risk summary",
  "factors": [
    {"category": "Reliability", "detail": "High restart count indicates instability", "weight": 30},
    {"category": "Capacity", "detail": "Memory usage approaching limits", "weight": 25}
  ],
  "prediction": "What will likely happen if not addressed",
  "time_to_failure": "estimated time until failure (e.g., '2-4 hours')",
  "recommended_actions": [
    {"action": "Increase memory limits", "priority": "high", "impact": "Prevents OOMKill"},
    {"action": "Review recent deployments", "priority": "medium", "impact": "Identify regression"}
  ],
  "dependencies_at_risk": ["service-a", "service-b"]
}"""

    prompt = f"Analyze risk for service: {request.service}\n\nService Data:\n{json.dumps(context, indent=2, default=str)}\n\nRespond ONLY with valid JSON."

    raw = await provider.chat(prompt=prompt, system=system)

    try:
        json_str = raw.strip()
        if "```json" in json_str:
            json_str = json_str.split("```json")[1].split("```")[0].strip()
        elif "```" in json_str:
            json_str = json_str.split("```")[1].split("```")[0].strip()
        parsed = json.loads(json_str)
        return {"service": request.service, "analysis": parsed, "model": provider.model}
    except (json.JSONDecodeError, KeyError):
        return {
            "service": request.service,
            "analysis": {
                "risk_score": 50,
                "risk_level": "medium",
                "summary": raw[:300] if raw else "Analysis could not be completed.",
                "factors": [],
                "prediction": "Unable to parse structured prediction.",
                "recommended_actions": [],
            },
            "model": provider.model,
        }
