"""RCA router — Root Cause Analysis using local LLM + cluster data.

Flow:
1. Receive incident ID + optional telemetry data
2. Fetch current cluster state from Discovery service
3. Fetch incidents from Monitoring service
4. Inject all data as context into the LLM
5. LLM analyzes root cause, confidence, evidence, recommendations
6. Return structured RCA response
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

RCA_SYSTEM_PROMPT = """You are Tagent RCA Engine — an expert Kubernetes root cause analysis system.

Given the INCIDENT DATA and CLUSTER STATE below, perform a thorough root cause analysis.

You MUST respond in valid JSON format with exactly these fields:
{
  "root_cause": "A clear, technical explanation of what caused this incident (2-3 sentences)",
  "confidence": 0.85,
  "evidence": ["evidence line 1", "evidence line 2", "evidence line 3"],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "blast_radius": ["affected-service-1", "affected-service-2"],
  "severity": "critical"
}

RULES:
1. Base your analysis ONLY on the data provided. Never guess.
2. Confidence should be between 0.0 and 1.0 based on how much evidence supports your conclusion.
3. Evidence must cite specific data points (pod names, restart counts, error codes, memory limits).
4. Recommendations must be actionable (restart pod X, increase memory limit to Y, rollback deployment Z).
5. Blast radius lists services that are affected downstream.
6. Severity must be one of: critical, high, medium, low.

INCIDENT DATA:
{incident_data}

CLUSTER STATE:
{cluster_state}
"""


class RCARequest(BaseModel):
    incident_id: str
    title: str | None = None
    service: str | None = None
    namespace: str | None = None
    logs: list | None = None
    metrics: dict | None = None
    events: list | None = None


class RCAResponse(BaseModel):
    incident_id: str
    root_cause: str
    confidence: float
    evidence: list
    recommendations: list
    blast_radius: list | None = None
    severity: str | None = None
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


@router.post("/rca", response_model=RCAResponse)
async def root_cause_analysis(request: RCARequest):
    """Perform root cause analysis on an incident using local LLM."""

    # Check Ollama health
    if not await provider.health():
        raise HTTPException(
            status_code=503,
            detail="Local LLM (Ollama) is not reachable. Make sure Ollama is running."
        )

    # Fetch incident data from monitoring
    incident_data = await fetch_incident_data(request.incident_id)

    # Enrich with request data
    if request.title:
        incident_data["title"] = request.title
    if request.service:
        incident_data["service"] = request.service
    if request.namespace:
        incident_data["namespace"] = request.namespace
    if request.logs:
        incident_data["logs"] = request.logs
    if request.metrics:
        incident_data["metrics"] = request.metrics
    if request.events:
        incident_data["events"] = request.events

    # Fetch cluster state
    cluster_state = await fetch_cluster_context()

    # Build prompt
    system = RCA_SYSTEM_PROMPT.format(
        incident_data=json.dumps(incident_data, indent=2, default=str),
        cluster_state=cluster_state
    )

    prompt = f"Perform root cause analysis for incident {request.incident_id}. Respond ONLY with valid JSON."

    # Query local LLM
    raw_response = await provider.chat(prompt=prompt, system=system)

    # Parse JSON response from LLM
    try:
        # Try to extract JSON from the response
        json_str = raw_response.strip()
        # Handle cases where LLM wraps in markdown code block
        if "```json" in json_str:
            json_str = json_str.split("```json")[1].split("```")[0].strip()
        elif "```" in json_str:
            json_str = json_str.split("```")[1].split("```")[0].strip()

        parsed = json.loads(json_str)

        return RCAResponse(
            incident_id=request.incident_id,
            root_cause=parsed.get("root_cause", "Unable to determine root cause from available data."),
            confidence=min(1.0, max(0.0, float(parsed.get("confidence", 0.5)))),
            evidence=parsed.get("evidence", []),
            recommendations=parsed.get("recommendations", []),
            blast_radius=parsed.get("blast_radius", []),
            severity=parsed.get("severity", "medium"),
            model=provider.model,
        )
    except (json.JSONDecodeError, KeyError, ValueError):
        # If LLM didn't return valid JSON, use the raw text as root cause
        return RCAResponse(
            incident_id=request.incident_id,
            root_cause=raw_response[:500] if raw_response else "Analysis failed — LLM returned unparseable response.",
            confidence=0.4,
            evidence=["LLM response was not structured JSON — raw analysis provided as root_cause"],
            recommendations=["Review the raw analysis above", "Ensure Ollama model supports JSON output"],
            blast_radius=[],
            severity="medium",
            model=provider.model,
        )
