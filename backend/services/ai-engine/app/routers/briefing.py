"""Morning Briefing router — generates overnight activity summaries.

Provides a text-based morning briefing that covers:
1. Incidents that occurred overnight
2. Remediations executed (by Night Guardian or manually)
3. Current cluster health status
4. Risk predictions for today
5. Recommendations for the day

Endpoints:
- GET  /briefing/latest       → get the latest generated briefing
- POST /briefing/generate     → generate a new briefing now
- GET  /briefing/history      → past briefings
"""

import json
import os
import time
from datetime import datetime

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

from app.context import fetch_cluster_context
from app.providers import OllamaProvider

router = APIRouter()
provider = OllamaProvider()

MONITORING_URL = os.getenv("MONITORING_URL", "http://localhost:8082")
REMEDIATION_URL = os.getenv("REMEDIATION_URL", "http://localhost:8084")

# Store briefings in memory (last 30)
_briefings: list[dict] = []


class BriefingResponse(BaseModel):
    id: str
    generated_at: str
    period: str  # "overnight", "last_24h", "custom"
    summary: str  # AI-generated executive summary
    sections: dict
    stats: dict
    model: str


@router.get("/latest")
async def get_latest_briefing():
    """Get the most recent briefing."""
    if _briefings:
        return _briefings[0]
    # Auto-generate if none exists
    return await generate_briefing_internal()


@router.post("/generate")
async def generate_briefing():
    """Generate a new morning briefing."""
    briefing = await generate_briefing_internal()
    return briefing


@router.get("/history")
async def get_briefing_history(limit: int = 10):
    """Get past briefings."""
    return {"briefings": _briefings[:limit], "total": len(_briefings)}


async def generate_briefing_internal() -> dict:
    """Core briefing generation logic."""

    # 1. Fetch all data
    incidents = await _fetch_incidents()
    remediations = await _fetch_remediations()
    cluster_context = await fetch_cluster_context()
    guardian_status = await _fetch_guardian_status()

    # 2. Calculate stats
    stats = {
        "total_incidents": len(incidents),
        "critical_incidents": len([i for i in incidents if i.get("severity") == "critical"]),
        "high_incidents": len([i for i in incidents if i.get("severity") == "high"]),
        "remediations_executed": len(remediations),
        "successful_remediations": len([r for r in remediations if r.get("status") == "success"]),
        "failed_remediations": len([r for r in remediations if r.get("status") == "failed"]),
        "guardian_active": guardian_status.get("config", {}).get("enabled", False),
        "guardian_runs": guardian_status.get("run_count", 0),
    }

    # 3. Build sections
    sections = {
        "incidents": _build_incidents_section(incidents),
        "remediations": _build_remediations_section(remediations),
        "cluster_health": _extract_cluster_health(cluster_context),
        "guardian": _build_guardian_section(guardian_status),
        "recommendations": [],
    }

    # 4. Generate AI summary
    ai_summary = ""
    model_used = "none"
    if await provider.health():
        ai_summary = await _generate_ai_briefing(incidents, remediations, cluster_context, stats)
        model_used = provider.model

        # Also get AI recommendations
        sections["recommendations"] = await _generate_recommendations(incidents, remediations, cluster_context)

    # 5. Build final briefing
    briefing_id = f"BRF-{int(time.time())}"
    now = datetime.utcnow()

    briefing = {
        "id": briefing_id,
        "generated_at": now.isoformat() + "Z",
        "period": "overnight",
        "greeting": _get_greeting(now),
        "summary": ai_summary or _build_fallback_summary(stats),
        "sections": sections,
        "stats": stats,
        "model": model_used,
    }

    # Store
    _briefings.insert(0, briefing)
    if len(_briefings) > 30:
        _briefings[:] = _briefings[:30]

    return briefing


# ===== Data Fetching =====

async def _fetch_incidents() -> list:
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            r = await client.get(f"{MONITORING_URL}/incidents")
            if r.status_code == 200:
                return r.json().get("incidents", [])
        except Exception:
            pass
    return []


async def _fetch_remediations() -> list:
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            r = await client.get(f"{REMEDIATION_URL}/history")
            if r.status_code == 200:
                return r.json().get("history", [])
        except Exception:
            pass
    return []


async def _fetch_guardian_status() -> dict:
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            r = await client.get(f"{REMEDIATION_URL}/night-guardian/status")
            if r.status_code == 200:
                return r.json()
        except Exception:
            pass
    return {}


# ===== Section Builders =====

def _build_incidents_section(incidents: list) -> list[dict]:
    """Build the incidents section for the briefing."""
    return [
        {
            "id": inc.get("id", ""),
            "title": inc.get("title", "Unknown"),
            "severity": inc.get("severity", "medium"),
            "status": inc.get("status", "active"),
            "service": f"{inc.get('namespace', 'unknown')}/{inc.get('service', 'unknown')}",
            "root_cause": inc.get("root_cause", inc.get("rootCause", "")),
        }
        for inc in incidents[:10]
    ]


def _build_remediations_section(remediations: list) -> list[dict]:
    """Build the remediations section."""
    return [
        {
            "action": r.get("action", "unknown"),
            "target": r.get("target", "unknown"),
            "status": r.get("status", "unknown"),
            "message": r.get("message", ""),
            "dry_run": r.get("dry_run", False),
        }
        for r in remediations[:10]
    ]


def _extract_cluster_health(context: str) -> dict:
    """Extract health info from cluster context string."""
    # Parse key metrics from the context text
    health = {"raw": context[:500] if context else "No cluster data available"}

    if "Running" in context:
        # Try to extract numbers
        for line in context.split("\n"):
            if "Pods:" in line:
                health["pods_summary"] = line.strip()
            elif "Nodes:" in line:
                health["nodes_summary"] = line.strip()
            elif "Deployments:" in line:
                health["deployments_summary"] = line.strip()

    return health


def _build_guardian_section(status: dict) -> dict:
    """Build Night Guardian section."""
    config = status.get("config", {})
    return {
        "enabled": config.get("enabled", False),
        "mode": status.get("mode", "unknown"),
        "runs": status.get("run_count", 0),
        "reports": status.get("report_count", 0),
        "confidence": config.get("confidence", 85),
    }


# ===== AI Generation =====

async def _generate_ai_briefing(incidents: list, remediations: list, context: str, stats: dict) -> str:
    """Generate AI executive briefing summary."""
    system = """You are Tagent Morning Briefing AI. Generate a concise, friendly morning briefing for an SRE/DevOps engineer.

Style: Conversational but technical. Like a colleague briefing you over coffee.
Length: 4-6 sentences covering: what happened, current state, what to watch today.
Tone: Professional, calm, actionable. If everything is fine, say so confidently."""

    data = f"""OVERNIGHT STATS:
- Incidents: {stats['total_incidents']} ({stats['critical_incidents']} critical, {stats['high_incidents']} high)
- Remediations: {stats['remediations_executed']} executed ({stats['successful_remediations']} success, {stats['failed_remediations']} failed)
- Night Guardian: {'Active' if stats['guardian_active'] else 'Disabled'} ({stats['guardian_runs']} runs)

CURRENT INCIDENTS:
{json.dumps([{'title': i.get('title',''), 'severity': i.get('severity',''), 'service': i.get('service','')} for i in incidents[:5]], indent=2)}

CLUSTER STATE (summary):
{context[:800]}

Generate the morning briefing summary. Be specific about what happened."""

    try:
        return await provider.chat(prompt=data, system=system)
    except Exception:
        return _build_fallback_summary(stats)


async def _generate_recommendations(incidents: list, remediations: list, context: str) -> list[str]:
    """Generate AI recommendations for the day."""
    system = """Generate 3-5 actionable recommendations for today based on overnight activity.
Each recommendation should be one sentence, specific and actionable.
Respond as a JSON array of strings: ["rec 1", "rec 2", "rec 3"]"""

    prompt = f"""Incidents: {len(incidents)} ({len([i for i in incidents if i.get('severity')=='critical'])} critical)
Failed remediations: {len([r for r in remediations if r.get('status')=='failed'])}
Cluster context: {context[:400]}

Generate recommendations. Respond ONLY with a JSON array."""

    try:
        raw = await provider.chat(prompt=prompt, system=system)
        # Parse JSON array
        json_str = raw.strip()
        if "```json" in json_str:
            json_str = json_str.split("```json")[1].split("```")[0].strip()
        elif "```" in json_str:
            json_str = json_str.split("```")[1].split("```")[0].strip()
        return json.loads(json_str)
    except Exception:
        return [
            "Review any overnight incidents and verify they are resolved",
            "Check Night Guardian logs for auto-remediation activity",
            "Monitor services with recent restarts for stability",
        ]


# ===== Helpers =====

def _build_fallback_summary(stats: dict) -> str:
    """Fallback summary when AI is unavailable."""
    if stats["total_incidents"] == 0:
        return "Good morning. All clear overnight — no incidents detected. Your cluster is healthy and all services are running normally."

    parts = ["Good morning. Here's your overnight summary:"]
    if stats["critical_incidents"] > 0:
        parts.append(f"{stats['critical_incidents']} critical incident(s) detected overnight.")
    if stats["high_incidents"] > 0:
        parts.append(f"{stats['high_incidents']} high-severity incident(s) detected.")
    if stats["remediations_executed"] > 0:
        parts.append(f"{stats['remediations_executed']} remediation(s) were executed ({stats['successful_remediations']} successful).")
    if stats["guardian_active"]:
        parts.append(f"Night Guardian was active and completed {stats['guardian_runs']} run(s).")

    return " ".join(parts)


def _get_greeting(now: datetime) -> str:
    """Get time-appropriate greeting."""
    hour = now.hour
    if hour < 12:
        return "Good morning"
    elif hour < 17:
        return "Good afternoon"
    else:
        return "Good evening"
