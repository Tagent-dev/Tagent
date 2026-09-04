"""Predictive Detection router — predicts failures before they happen.

Endpoints:
- GET  /predictive/predictions  → current failure predictions
- GET  /predictive/stats        → model statistics
- POST /predictive/explain      → AI explanation of a prediction
- POST /predictive/collect      → trigger a manual data collection
"""

import json

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import predictive
from app.providers import OllamaProvider

router = APIRouter()
provider = OllamaProvider()


class ExplainRequest(BaseModel):
    resource: str
    predicted_issue: str
    evidence: list[str] = []


class ExplainResponse(BaseModel):
    resource: str
    explanation: str
    root_cause_hypothesis: str
    recommended_actions: list[str]
    confidence: float
    model: str


@router.get("/predictions")
async def get_predictions():
    """Get all current failure predictions."""
    predictions = predictive.run_all_predictions()
    return {
        "predictions": predictions,
        "total": len(predictions),
        "model_stats": predictive.get_model_stats(),
    }


@router.get("/stats")
async def get_stats():
    """Get predictive model statistics."""
    return predictive.get_model_stats()


@router.post("/collect")
async def trigger_collection():
    """Trigger a manual data collection snapshot."""
    await predictive.collect_snapshot()
    return {
        "status": "collected",
        "data_points": predictive.get_history_count(),
        "tracked_resources": predictive.get_tracked_resources(),
    }


@router.post("/explain", response_model=ExplainResponse)
async def explain_prediction(request: ExplainRequest):
    """Use AI to explain a prediction and suggest actions."""
    if not await provider.health():
        raise HTTPException(status_code=503, detail="Ollama not reachable.")

    system = """You are Tagent Predictive AI. Given a failure prediction and its evidence,
provide a detailed explanation of what is happening and what will likely fail.

Respond in JSON:
{
  "explanation": "2-3 sentences explaining the prediction in plain English",
  "root_cause_hypothesis": "Most likely root cause based on the evidence",
  "recommended_actions": ["action 1", "action 2", "action 3"],
  "confidence": 0.85
}"""

    prompt = f"""Prediction: {request.predicted_issue}
Resource: {request.resource}
Evidence:
{json.dumps(request.evidence, indent=2)}

Explain this prediction and recommend preventive actions. Respond ONLY with valid JSON."""

    raw = await provider.chat(prompt=prompt, system=system)

    try:
        json_str = raw.strip()
        if "```json" in json_str:
            json_str = json_str.split("```json")[1].split("```")[0].strip()
        elif "```" in json_str:
            json_str = json_str.split("```")[1].split("```")[0].strip()
        parsed = json.loads(json_str)

        return ExplainResponse(
            resource=request.resource,
            explanation=parsed.get("explanation", ""),
            root_cause_hypothesis=parsed.get("root_cause_hypothesis", ""),
            recommended_actions=parsed.get("recommended_actions", []),
            confidence=parsed.get("confidence", 0.7),
            model=provider.model,
        )
    except (json.JSONDecodeError, KeyError):
        return ExplainResponse(
            resource=request.resource,
            explanation=raw[:300] if raw else "Analysis failed.",
            root_cause_hypothesis="Unable to determine from available data.",
            recommended_actions=["Monitor the resource closely", "Check application logs"],
            confidence=0.5,
            model=provider.model,
        )
