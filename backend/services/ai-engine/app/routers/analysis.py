"""Analysis router — Incident correlation and blast radius analysis using local LLM.

Flow:
1. Receive incident ID + optional telemetry
2. Fetch cluster state and incidents
3. LLM correlates signals, identifies affected services, calculates severity
4. Return structured analysis
"""

import json
import os

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.context import fetch_cluster_context
from app.providers import OllamaProvider

router = APIRouter()
provider = OllamaProvider()

MONITORING_URL = os.getenv("MONITORING_URL", "http://localhost:8082")

ANALYSIS_SYSTEM_PROMPT = """You are Tagent Analysis Engine — a Kubernetes incident correlation system.

Given the INCIDENT DATA and CLUSTER STATE, analyze the incident and correlate signals.

You MUST respond in valid JSON format with exactly these fields:
{
  "severity": "critical",
  "summary": "A 2-3 sentence summary of what is happening and its impact",
  "correlated_events": [
    {"type": "pod_crash", "resource": "namespace/pod-name", "detail": "CrashLoopBackOff with 14 restarts"},
    {"type": "high_memory", "resource": "namespace/pod-name", "detail": "Memory at 95% of limit"}
  ],
  "blast_radius": {
    "affected_services": ["service-a", "service-b"],
    "affected_pods": 3,
    "affected_namespaces": ["production"],
    "user_impact": "Estimated 15% of requests failing"
  },
  "timeline": [
    {"time": "T-5m", "event": "Deployment updated"},
    {"time": "T-3m", "event": "Memory usage spike"},
    {"time": "T-0", "event": "Pod entered CrashLoopBackOff"}
  ]
}

RULES:
1. Base analysis ONLY on the data provided.
2. Severity: critical (service down), high (degraded), medium (warning), low (informational).
3. Correlated events should link related signals (e.g., deployment change → memory spike → crash).
4. Blast radius estimates downstream impact.
5. Timeline reconstructs what happened in order.

INCIDENT DATA:
{incident_data}

CLUSTER STATE:
{cluster_state}
"""


class AnalysisRequest(BaseModel):
    incident_id: str
    title: str | None = None
    service: str | None = None
    namespace: str | None = None
    telemetry: dict | None = None


class CorrelatedEvent(BaseModel):
    type: str
    resource: str
    detail: str


class BlastRadius(BaseModel):
    affected_services: list = []
    affected_pods: int = 0
    affected_namespaces: list = []
    user_impact: str = ""


class TimelineEvent(BaseModel):
    time: str
    event: str


class AnalysisResponse(BaseModel):
    incident_id: str
    severity: str
    summary: str
    correlated_events: list
    blast_radius: dict
    timeline: list | None = None
    model: str


async def fetch_incident_data(incident_id: str) -> dict:
    """Fetch incident details from the monitoring service."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            r = await client.get(f"{MONITORING_URL}/incidents")
            if r.status_code == 200:
                data = r.json()
                for inc in data.get("incidents", []):
                    if inc.get("id") == incident_id:
                        return inc
        except Exception:
            pass
    return {"id": incident_id, "status": "not_found_in_monitoring"}


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_incident(request: AnalysisRequest):
    """Analyze an incident — correlate signals, calculate blast radius."""

    # Check Ollama health
    if not await provider.health():
        raise HTTPException(
            status_code=503,
            detail="Local LLM (Ollama) is not reachable. Make sure Ollama is running."
        )

    # Fetch incident data
    incident_data = await fetch_incident_data(request.incident_id)

    # Enrich with request data
    if request.title:
        incident_data["title"] = request.title
    if request.service:
        incident_data["service"] = request.service
    if request.namespace:
        incident_data["namespace"] = request.namespace
    if request.telemetry:
        incident_data["telemetry"] = request.telemetry

    # Fetch cluster state
    cluster_state = await fetch_cluster_context()

    # Build prompt
    system = ANALYSIS_SYSTEM_PROMPT.format(
        incident_data=json.dumps(incident_data, indent=2, default=str),
        cluster_state=cluster_state
    )

    prompt = f"Analyze incident {request.incident_id} and correlate all signals. Respond ONLY with valid JSON."

    # Query local LLM
    raw_response = await provider.chat(prompt=prompt, system=system)

    # Parse JSON response
    try:
        json_str = raw_response.strip()
        if "```json" in json_str:
            json_str = json_str.split("```json")[1].split("```")[0].strip()
        elif "```" in json_str:
            json_str = json_str.split("```")[1].split("```")[0].strip()

        parsed = json.loads(json_str)

        return AnalysisResponse(
            incident_id=request.incident_id,
            severity=parsed.get("severity", "medium"),
            summary=parsed.get("summary", "Analysis complete."),
            correlated_events=parsed.get("correlated_events", []),
            blast_radius=parsed.get("blast_radius", {}),
            timeline=parsed.get("timeline", []),
            model=provider.model,
        )
    except (json.JSONDecodeError, KeyError, ValueError):
        return AnalysisResponse(
            incident_id=request.incident_id,
            severity="medium",
            summary=raw_response[:300] if raw_response else "Analysis failed.",
            correlated_events=[],
            blast_radius={"affected_services": [], "affected_pods": 0, "affected_namespaces": [], "user_impact": "Unknown"},
            timeline=[],
            model=provider.model,
        )
