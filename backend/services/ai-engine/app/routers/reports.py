"""Reports router — auto-generate and export incident reports.

Endpoints:
- GET  /reports              → list all generated reports
- GET  /reports/:id          → get specific report (markdown)
- GET  /reports/:id/pdf      → get report as PDF-ready HTML
- POST /reports/generate     → generate report for an incident
- POST /reports/generate-all → generate reports for all resolved incidents
"""

import os

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from app import reports as report_engine
from app.providers import OllamaProvider

router = APIRouter()
provider = OllamaProvider()

MONITORING_URL = os.getenv("MONITORING_URL", "http://localhost:8082")


class GenerateRequest(BaseModel):
    incident_id: str


@router.get("")
async def list_reports(limit: int = 50):
    """List all generated reports."""
    all_reports = await report_engine.get_reports(limit)
    # Return without full content for list view
    summaries = []
    for r in all_reports:
        summaries.append({
            "id": r.get("id"),
            "incident_id": r.get("incident_id"),
            "title": r.get("title"),
            "severity": r.get("severity"),
            "duration": r.get("duration", ""),
            "generated_at": r.get("generated_at", ""),
            "resolved_at": r.get("resolved_at", r.get("generated_at", "")),
            "status": r.get("status", "generated"),
        })
    return {"reports": summaries, "total": len(summaries)}


@router.get("/{report_id}")
async def get_report(report_id: str):
    """Get a specific report with full markdown content."""
    report = await report_engine.get_report(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.get("/{report_id}/pdf", response_class=HTMLResponse)
async def get_report_pdf(report_id: str):
    """Get report as PDF-ready HTML.
    
    Open this in a browser and use Print → Save as PDF,
    or use wkhtmltopdf/weasyprint for automated conversion.
    """
    report = await report_engine.get_report(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    html = report_engine.generate_pdf_html(report)
    return HTMLResponse(content=html)


@router.post("/generate")
async def generate_report(request: GenerateRequest):
    """Generate a report for a specific incident."""
    report = await report_engine.generate_report(request.incident_id, provider=provider)
    return {
        "status": "generated",
        "report_id": report["id"],
        "incident_id": report["incident_id"],
        "title": report["title"],
        "severity": report["severity"],
        "duration": report.get("duration", ""),
        "sections": report.get("sections", {}),
    }


@router.post("/generate-all")
async def generate_all_reports():
    """Generate reports for all current incidents."""
    generated = []

    async with httpx.AsyncClient(timeout=10.0) as client:
        # Fetch all incidents
        try:
            r = await client.get(f"{MONITORING_URL}/incidents")
            if r.status_code == 200:
                incidents = r.json().get("incidents", [])
                for inc in incidents[:10]:  # Max 10 at a time
                    report = await report_engine.generate_report(inc["id"], provider=provider)
                    generated.append({
                        "report_id": report["id"],
                        "incident_id": inc["id"],
                        "title": inc.get("title", ""),
                    })
        except Exception as e:
            return {"status": "error", "error": str(e), "generated": generated}

    return {"status": "complete", "generated": generated, "total": len(generated)}
