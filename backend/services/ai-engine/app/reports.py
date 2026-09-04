"""Incident Report Generator — auto-generates structured reports after incidents resolve.

Generates:
1. Markdown report (stored in PostgreSQL)
2. PDF export (generated on demand via HTML→PDF)
3. AI-powered summary using Ollama

Report sections:
- Executive Summary
- Incident Timeline
- Root Cause Analysis
- Impact Assessment (blast radius)
- Actions Taken
- Verification Result
- Prevention Recommendations
- Lessons Learned
"""

import json
import os
import time
from datetime import datetime

import httpx

MONITORING_URL = os.getenv("MONITORING_URL", "http://localhost:8082")
REMEDIATION_URL = os.getenv("REMEDIATION_URL", "http://localhost:8084")
DATABASE_URL = os.getenv("DATABASE_URL", "")

# In-memory report store (fallback if no PostgreSQL)
_reports: list[dict] = []


async def generate_report(incident_id: str, provider=None) -> dict:
    """Generate a full incident report.
    
    Fetches incident data, remediation history, and uses AI for summary.
    """
    # Fetch incident data
    incident = await _fetch_incident(incident_id)
    actions = await _fetch_actions_for_incident(incident_id)

    # Build report
    report_id = f"RPT-{int(time.time())}-{incident_id}"
    now = datetime.utcnow()

    # Calculate duration
    started_at = incident.get("detected_at") or incident.get("startedAt") or now.isoformat()
    duration = _calculate_duration(started_at)

    # Generate AI summary if provider available
    ai_summary = ""
    if provider and await provider.health():
        ai_summary = await _generate_ai_summary(provider, incident, actions)

    # Build markdown content
    markdown = _build_markdown_report(
        incident=incident,
        actions=actions,
        ai_summary=ai_summary,
        duration=duration,
        generated_at=now.isoformat(),
    )

    report = {
        "id": report_id,
        "incident_id": incident_id,
        "title": incident.get("title", f"Incident {incident_id}"),
        "severity": incident.get("severity", "medium"),
        "status": "generated",
        "duration": duration,
        "generated_at": now.isoformat() + "Z",
        "resolved_at": now.isoformat() + "Z",
        "content": markdown,
        "sections": {
            "summary": ai_summary or f"Incident {incident_id} has been resolved.",
            "root_cause": incident.get("root_cause", incident.get("rootCause", "Not determined")),
            "impact": incident.get("namespace", "unknown") + "/" + incident.get("service", "unknown"),
            "actions_taken": len(actions),
            "recommendations": _extract_recommendations(incident, actions),
        },
        "metadata": {
            "incident": incident,
            "actions": actions,
        },
    }

    # Store report
    _reports.insert(0, report)
    if len(_reports) > 200:
        _reports[:] = _reports[:200]

    # Also store in PostgreSQL if available
    await _store_report_db(report)

    return report


async def get_reports(limit: int = 50) -> list[dict]:
    """Get all generated reports."""
    # Try PostgreSQL first
    db_reports = await _get_reports_db(limit)
    if db_reports:
        return db_reports
    return _reports[:limit]


async def get_report(report_id: str) -> dict | None:
    """Get a specific report by ID."""
    for r in _reports:
        if r["id"] == report_id:
            return r
    return None


def generate_pdf_html(report: dict) -> str:
    """Generate HTML suitable for PDF conversion.
    
    This HTML can be converted to PDF using:
    - weasyprint (Python)
    - wkhtmltopdf (CLI)
    - Browser print-to-PDF
    """
    content = report.get("content", "")
    title = report.get("title", "Incident Report")
    severity = report.get("severity", "medium")
    generated_at = report.get("generated_at", "")
    duration = report.get("duration", "unknown")

    severity_colors = {
        "critical": "#dc2626",
        "high": "#ea580c",
        "medium": "#d97706",
        "low": "#16a34a",
    }
    sev_color = severity_colors.get(severity, "#6b7280")

    # Convert markdown to HTML (basic conversion)
    html_content = _markdown_to_html(content)

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>{title} - Tagent Incident Report</title>
<style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1f2937; padding: 40px; max-width: 800px; margin: 0 auto; }}
    .header {{ border-bottom: 3px solid #10b981; padding-bottom: 20px; margin-bottom: 30px; }}
    .header h1 {{ font-size: 24px; color: #111827; margin-bottom: 8px; }}
    .header .meta {{ display: flex; gap: 16px; font-size: 13px; color: #6b7280; }}
    .severity {{ display: inline-block; padding: 2px 10px; border-radius: 4px; font-weight: 600; font-size: 11px; text-transform: uppercase; color: white; background: {sev_color}; }}
    .content {{ line-height: 1.7; }}
    .content h2 {{ font-size: 18px; color: #111827; margin: 24px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #e5e7eb; }}
    .content h3 {{ font-size: 15px; color: #374151; margin: 16px 0 8px; }}
    .content p {{ margin: 8px 0; font-size: 14px; }}
    .content ul {{ margin: 8px 0 8px 20px; }}
    .content li {{ margin: 4px 0; font-size: 14px; }}
    .content code {{ background: #f3f4f6; padding: 1px 4px; border-radius: 3px; font-size: 13px; }}
    .content pre {{ background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; margin: 12px 0; overflow-x: auto; font-size: 12px; }}
    .footer {{ margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }}
    @media print {{ body {{ padding: 20px; }} }}
</style>
</head>
<body>
<div class="header">
    <h1>📋 {title}</h1>
    <div class="meta">
        <span>Report: {report.get('id', '')}</span>
        <span>Incident: {report.get('incident_id', '')}</span>
        <span class="severity">{severity}</span>
        <span>Duration: {duration}</span>
        <span>Generated: {generated_at[:19]}</span>
    </div>
</div>
<div class="content">
{html_content}
</div>
<div class="footer">
    Generated by Tagent AI Operations Platform — {generated_at[:10]}<br>
    This report was auto-generated. All AI analysis uses local models only.
</div>
</body>
</html>"""


# ===== Internal Helpers =====

async def _fetch_incident(incident_id: str) -> dict:
    """Fetch incident data from monitoring + remediation."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        # Try monitoring
        try:
            r = await client.get(f"{MONITORING_URL}/incidents")
            if r.status_code == 200:
                for inc in r.json().get("incidents", []):
                    if inc.get("id") == incident_id:
                        return inc
        except Exception:
            pass

        # Try remediation
        try:
            r = await client.get(f"{REMEDIATION_URL}/incidents")
            if r.status_code == 200:
                for inc in r.json().get("incidents", []):
                    if inc.get("id") == incident_id:
                        return inc
        except Exception:
            pass

    return {"id": incident_id, "title": f"Incident {incident_id}", "status": "unknown"}


async def _fetch_actions_for_incident(incident_id: str) -> list[dict]:
    """Fetch remediation actions related to this incident."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            r = await client.get(f"{REMEDIATION_URL}/history")
            if r.status_code == 200:
                history = r.json().get("history", [])
                return [a for a in history if incident_id.lower() in a.get("target", "").lower() or incident_id.lower() in a.get("reason", "").lower()]
        except Exception:
            pass
    return []


async def _generate_ai_summary(provider, incident: dict, actions: list) -> str:
    """Generate AI-powered executive summary."""
    system = """You are Tagent Report Writer. Write a concise executive summary of an incident report.
Include: what happened, impact, what was done, current status.
Keep it under 150 words. Be factual and technical."""

    prompt = f"""Incident: {incident.get('title', 'Unknown')}
Severity: {incident.get('severity', 'medium')}
Service: {incident.get('namespace', 'unknown')}/{incident.get('service', 'unknown')}
Root Cause: {incident.get('root_cause', incident.get('rootCause', 'Not determined'))}
Evidence: {json.dumps(incident.get('evidence', [])[:3])}
Actions Taken: {len(actions)}
Status: {incident.get('status', 'unknown')}

Write an executive summary."""

    try:
        return await provider.chat(prompt=prompt, system=system)
    except Exception:
        return ""


def _build_markdown_report(incident: dict, actions: list, ai_summary: str, duration: str, generated_at: str) -> str:
    """Build the full markdown report."""
    title = incident.get("title", "Incident Report")
    severity = incident.get("severity", "medium")
    service = incident.get("service", "unknown")
    namespace = incident.get("namespace", "unknown")
    root_cause = incident.get("root_cause", incident.get("rootCause", "Not yet determined"))
    evidence = incident.get("evidence", [])
    incident_id = incident.get("id", "unknown")

    lines = []
    lines.append(f"# Incident Report: {title}\n")
    lines.append(f"**ID:** {incident_id}  ")
    lines.append(f"**Severity:** {severity.upper()}  ")
    lines.append(f"**Duration:** {duration}  ")
    lines.append(f"**Service:** {namespace}/{service}  ")
    lines.append(f"**Generated:** {generated_at}\n")

    # Executive Summary
    lines.append("## Executive Summary\n")
    if ai_summary:
        lines.append(ai_summary + "\n")
    else:
        lines.append(f"An incident was detected in {namespace}/{service} with {severity} severity. " +
                     f"The incident lasted {duration}.\n")

    # Timeline
    lines.append("## Timeline\n")
    lines.append("- **Detected:** Incident identified by Tagent monitoring")
    if actions:
        for a in actions[:5]:
            status_icon = "✓" if a.get("status") == "success" else "✗" if a.get("status") == "failed" else "○"
            lines.append(f"- **{status_icon} Action:** {a.get('action', 'unknown')} on {a.get('target', 'unknown')} — {a.get('status', 'unknown')}")
    lines.append(f"- **Resolved:** Report generated at {generated_at[:19]}\n")

    # Root Cause
    lines.append("## Root Cause Analysis\n")
    lines.append(f"{root_cause}\n")

    # Evidence
    if evidence:
        lines.append("## Evidence\n")
        for e in evidence:
            lines.append(f"- {e}")
        lines.append("")

    # Impact
    lines.append("## Impact Assessment\n")
    lines.append(f"- **Affected Service:** {namespace}/{service}")
    lines.append(f"- **Severity Level:** {severity}")
    lines.append(f"- **Duration:** {duration}\n")

    # Actions Taken
    lines.append("## Actions Taken\n")
    if actions:
        for a in actions:
            dry_run = " (DRY-RUN)" if a.get("dry_run") else ""
            lines.append(f"- **{a.get('action', 'unknown')}** on `{a.get('target', 'unknown')}` — {a.get('status', 'unknown')}{dry_run}: {a.get('message', '')}")
    else:
        lines.append("- No automated actions were executed for this incident.")
    lines.append("")

    # Recommendations
    lines.append("## Prevention Recommendations\n")
    recs = _extract_recommendations(incident, actions)
    for r in recs:
        lines.append(f"- {r}")
    lines.append("")

    # Footer
    lines.append("---\n")
    lines.append("*Report auto-generated by Tagent AI Operations Platform. All analysis performed using local models.*\n")

    return "\n".join(lines)


def _extract_recommendations(incident: dict, actions: list) -> list[str]:
    """Generate prevention recommendations based on incident type."""
    title = (incident.get("title", "") + " " + incident.get("root_cause", incident.get("rootCause", ""))).lower()

    recs = []
    if "crashloop" in title or "restart" in title:
        recs.extend([
            "Add proper liveness and readiness probes with appropriate thresholds",
            "Implement graceful shutdown handling in the application",
            "Set up alerting for restart count > 3 within 5 minutes",
        ])
    elif "oom" in title or "memory" in title:
        recs.extend([
            "Review and increase memory limits based on observed usage patterns",
            "Implement memory profiling to identify leaks",
            "Consider using Vertical Pod Autoscaler (VPA) for dynamic limits",
        ])
    elif "notready" in title or "node" in title:
        recs.extend([
            "Set up monitoring for node disk pressure and memory pressure",
            "Configure pod anti-affinity to spread workloads across nodes",
            "Implement node auto-repair or auto-scaling for resilience",
        ])
    else:
        recs.extend([
            "Review monitoring thresholds and alerting rules",
            "Document this incident pattern in the knowledge base",
            "Consider adding automated remediation for this failure mode",
        ])

    return recs


def _calculate_duration(started_at: str) -> str:
    """Calculate duration from started_at to now."""
    try:
        start = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        now = datetime.utcnow()
        delta = now - start.replace(tzinfo=None)
        minutes = int(delta.total_seconds() / 60)
        if minutes < 60:
            return f"{minutes}m"
        hours = minutes // 60
        remaining_min = minutes % 60
        return f"{hours}h {remaining_min}m"
    except Exception:
        return "unknown"


def _markdown_to_html(md: str) -> str:
    """Basic markdown to HTML conversion (no external dependencies)."""
    html_lines = []
    in_list = False

    for line in md.split("\n"):
        stripped = line.strip()

        if stripped.startswith("# "):
            if in_list:
                html_lines.append("</ul>")
                in_list = False
            html_lines.append(f"<h2>{stripped[2:]}</h2>")
        elif stripped.startswith("## "):
            if in_list:
                html_lines.append("</ul>")
                in_list = False
            html_lines.append(f"<h2>{stripped[3:]}</h2>")
        elif stripped.startswith("### "):
            if in_list:
                html_lines.append("</ul>")
                in_list = False
            html_lines.append(f"<h3>{stripped[4:]}</h3>")
        elif stripped.startswith("- "):
            if not in_list:
                html_lines.append("<ul>")
                in_list = True
            content = stripped[2:]
            content = content.replace("**", "<strong>", 1).replace("**", "</strong>", 1)
            content = content.replace("`", "<code>", 1).replace("`", "</code>", 1)
            html_lines.append(f"<li>{content}</li>")
        elif stripped.startswith("---"):
            if in_list:
                html_lines.append("</ul>")
                in_list = False
            html_lines.append("<hr>")
        elif stripped.startswith("*") and stripped.endswith("*"):
            html_lines.append(f"<p><em>{stripped[1:-1]}</em></p>")
        elif stripped:
            if in_list:
                html_lines.append("</ul>")
                in_list = False
            content = stripped
            content = content.replace("**", "<strong>", 1).replace("**", "</strong>", 1)
            content = content.replace("`", "<code>", 1).replace("`", "</code>", 1)
            html_lines.append(f"<p>{content}</p>")

    if in_list:
        html_lines.append("</ul>")

    return "\n".join(html_lines)


async def _store_report_db(report: dict):
    """Store report in PostgreSQL if available."""
    if not DATABASE_URL:
        return
    try:
        import asyncpg
        conn = await asyncpg.connect(DATABASE_URL)
        await conn.execute("""
            INSERT INTO reports (id, incident_id, title, severity, status, namespace, target, content, payload, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, NOW())
            ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, payload = EXCLUDED.payload
        """, report["id"], report["incident_id"], report["title"], report["severity"],
            "generated", report.get("sections", {}).get("impact", ""), report["incident_id"],
            report["content"], json.dumps(report.get("metadata", {})))
        await conn.close()
    except Exception:
        pass


async def _get_reports_db(limit: int) -> list[dict]:
    """Get reports from PostgreSQL."""
    if not DATABASE_URL:
        return []
    try:
        import asyncpg
        conn = await asyncpg.connect(DATABASE_URL)
        rows = await conn.fetch("""
            SELECT id, incident_id, title, severity, content, created_at
            FROM reports ORDER BY created_at DESC LIMIT $1
        """, limit)
        await conn.close()
        return [
            {
                "id": r["id"],
                "incident_id": r["incident_id"],
                "title": r["title"],
                "severity": r["severity"],
                "content": r["content"],
                "generated_at": r["created_at"].isoformat() + "Z",
            }
            for r in rows
        ]
    except Exception:
        return []
