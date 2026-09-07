"use client";

import { useEffect, useState } from "react";
import { getRiskScores, getPredictivePredictions, type ServiceRisk, type PredictiveResult } from "@/lib/api";

interface Insight {
    text: string;
    sub: string;
    confidence: number;
    color: string;
}

interface RiskDetail {
    deployment: string;
    issue: string;
    cause: string;
    action: string;
    confidence: number;
    severity: string;
}

export function AIDeploymentInsights() {
    const [insights, setInsights] = useState<Insight[]>([]);
    const [topRisk, setTopRisk] = useState<RiskDetail | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const [riskData, predictions] = await Promise.all([
                    getRiskScores().catch(() => ({ services: [], total: 0, calculated_at: "" })),
                    getPredictivePredictions().catch(() => ({ predictions: [], total: 0, model_stats: null })),
                ]);
                const services = riskData.services || [];
                const preds = (predictions.predictions || []) as PredictiveResult[];

                // Derive insights
                const derived: Insight[] = [];
                const healthy = services.filter(s => s.risk_level === "low");
                const critical = services.filter(s => s.risk_level === "critical" || s.risk_level === "high");

                if (healthy.length > 0 && critical.length === 0) {
                    derived.push({ text: "Deployment fleet is healthy", sub: "No critical issues detected across all namespaces", confidence: 99, color: "#3fb950" });
                }
                for (const s of critical.slice(0, 2)) {
                    derived.push({
                        text: `${s.service} at risk`,
                        sub: s.prediction || s.recommended_action,
                        confidence: Math.round(100 - s.risk_score),
                        color: s.risk_level === "critical" ? "#f85149" : "#f0883e",
                    });
                }
                for (const p of preds.slice(0, 2)) {
                    derived.push({
                        text: p.preventive_action,
                        sub: `${p.resource}: ${p.predicted_issue}`,
                        confidence: Math.round(p.confidence * 100),
                        color: p.probability > 0.7 ? "#f85149" : p.probability > 0.4 ? "#f0883e" : "#3fb950",
                    });
                }
                if (derived.length === 0) {
                    derived.push({ text: "All deployments stable", sub: "No issues detected", confidence: 98, color: "#3fb950" });
                }
                setInsights(derived.slice(0, 5));

                // Top risk for Risk Analysis section
                if (critical.length > 0) {
                    const top = critical[0];
                    setTopRisk({
                        deployment: top.service,
                        issue: top.prediction || "Elevated risk",
                        cause: top.factors?.[0]?.detail || "Unknown",
                        action: top.recommended_action,
                        confidence: Math.round(100 - top.risk_score),
                        severity: top.risk_level,
                    });
                } else {
                    setTopRisk(null);
                }
            } catch { }
        }
        load();
        const interval = setInterval(load, 15000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3.5 flex flex-col">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <h3 className="text-[13px] font-semibold text-[#f7f8f8]">AI Deployment Insights</h3>
                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#3fb950]/10 border border-[#3fb950]/30">
                        <span className="w-1 h-1 rounded-full bg-[#3fb950]" style={{ boxShadow: "0 0 4px #3fb950", animation: "wi-pulse 2s infinite" }} />
                        <span className="text-[9px] text-[#3fb950] font-semibold">Live</span>
                    </div>
                </div>
                <button className="text-[10px] text-[#7170ff] hover:text-[#79c0ff]">View all</button>
            </div>
            <div className="space-y-2 flex-1">
                {insights.length === 0 && <p className="text-[10px] text-[#64748b] text-center py-3">No data available</p>}
                {insights.map((ins, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)]">
                        <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: ins.color, boxShadow: `0 0 4px ${ins.color}` }} />
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-[#f7f8f8] leading-snug">{ins.text}</p>
                            <p className="text-[10px] text-[#64748b] mt-0.5">{ins.sub}</p>
                        </div>
                        <span className="text-[10px] text-[#64748b] font-mono shrink-0">Confidence <span className="font-semibold" style={{ color: ins.color }}>{ins.confidence}%</span></span>
                    </div>
                ))}
            </div>

            {/* Risk Analysis section */}
            {topRisk && (
                <div className="mt-3 pt-3 border-t border-[rgba(15,23,42,0.10)]">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <h4 className="text-[12px] font-semibold text-[#f7f8f8]">Risk Analysis</h4>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase" style={{ background: topRisk.severity === "critical" ? "rgba(248,81,73,0.15)" : "rgba(240,136,62,0.15)", color: topRisk.severity === "critical" ? "#f85149" : "#f0883e" }}>{topRisk.severity}</span>
                        </div>
                        <button className="text-[10px] text-[#7170ff]">View full analysis</button>
                    </div>
                    <div className="rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] p-2.5">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-[10px] text-[#64748b]">Deployment</p>
                                <p className="text-[12px] font-semibold text-[#f7f8f8]">{topRisk.deployment}</p>
                                <p className="text-[10px] text-[#64748b] mt-1">Issue</p>
                                <p className="text-[11px] text-[#f85149] font-medium">{topRisk.issue}</p>
                                <p className="text-[10px] text-[#64748b] mt-1">Likely Cause</p>
                                <p className="text-[11px] text-[#f7f8f8]">{topRisk.cause}</p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-[9px] text-[#64748b]">Confidence</p>
                                <p className="text-[18px] font-bold text-[#3fb950] font-mono">{topRisk.confidence}%</p>
                            </div>
                        </div>
                        <div className="mt-2">
                            <p className="text-[10px] text-[#64748b]">Suggested Action</p>
                            <p className="text-[10.5px] text-[#f7f8f8]">{topRisk.action}</p>
                        </div>
                        <button className="mt-2 w-full py-1.5 rounded-md text-[11px] font-semibold text-white" style={{ background: "linear-gradient(135deg, #7170ff, #7c3aed)", boxShadow: "0 0 8px rgba(124,58,237,0.3)" }}>
                            View Remediation Steps
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
