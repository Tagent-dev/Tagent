"use client";

import { useEffect, useState } from "react";
import { getAutoscaling, getPredictivePredictions } from "@/lib/api";

const ALL_INSIGHTS = [
    { text: "API Gateway scaling efficiently", sub: "Traffic pattern matches capacity", confidence: 96, impact: "Optimal", impactColor: "#3fb950" },
    { text: "AI Engine expected to scale", sub: "Demand surge predicted in 12m", confidence: 95, impact: "High", impactColor: "#f0883e" },
    { text: "Checkout workload near CPU limit", sub: "CPU at 87%, scaling recommended", confidence: 92, impact: "Medium", impactColor: "#f0883e" },
    { text: "Resource allocation optimized", sub: "No over-provisioning detected", confidence: 97, impact: "Optimal", impactColor: "#3fb950" },
    { text: "No scaling anomalies detected", sub: "Scaling behavior is normal", confidence: 96, impact: "Optimal", impactColor: "#3fb950" },
    { text: "Notification service stable", sub: "No scaling needed in next 30m", confidence: 94, impact: "Optimal", impactColor: "#3fb950" },
    { text: "Worker batch job idle", sub: "Consider scaling to zero", confidence: 91, impact: "Low", impactColor: "#22d3ee" },
];

function deriveInsights(
    hpas: Array<{ name: string; current: number; desired: number; min: number; max: number; status: string }>,
    predictions: Array<{ resource: string; predicted_issue: string; probability: number; confidence: number }>
) {
    const insights: typeof ALL_INSIGHTS = [];

    for (const hpa of hpas) {
        if (hpa.current < hpa.desired) {
            insights.push({
                text: `${hpa.name} scaling up`,
                sub: `Current ${hpa.current} → Desired ${hpa.desired}`,
                confidence: 94,
                impact: "High",
                impactColor: "#f0883e",
            });
        } else if (hpa.current >= hpa.max * 0.9) {
            insights.push({
                text: `${hpa.name} near max capacity`,
                sub: `At ${hpa.current}/${hpa.max} replicas`,
                confidence: 92,
                impact: "Medium",
                impactColor: "#f0883e",
            });
        } else if (hpa.current === hpa.desired && hpa.status === "Healthy") {
            insights.push({
                text: `${hpa.name} scaling efficiently`,
                sub: "Traffic pattern matches capacity",
                confidence: 96,
                impact: "Optimal",
                impactColor: "#3fb950",
            });
        } else if (hpa.current <= hpa.min) {
            insights.push({
                text: `${hpa.name} at minimum`,
                sub: "Consider scaling to zero if idle",
                confidence: 91,
                impact: "Low",
                impactColor: "#22d3ee",
            });
        }
    }

    for (const pred of predictions.slice(0, 3)) {
        insights.push({
            text: `${pred.resource} predicted issue`,
            sub: pred.predicted_issue,
            confidence: Math.round(pred.confidence * 100) || Math.round(pred.probability * 100),
            impact: pred.probability > 0.7 ? "High" : "Medium",
            impactColor: pred.probability > 0.7 ? "#f0883e" : "#a371f7",
        });
    }

    return insights.length > 0 ? insights : [];
}

export function AICapacityInsights() {
    const [showAll, setShowAll] = useState(false);
    const [insights, setInsights] = useState<typeof ALL_INSIGHTS>([]);

    useEffect(() => {
        function load() {
            Promise.all([
                getAutoscaling().catch(() => null),
                getPredictivePredictions().catch(() => null),
            ]).then(([autoscaling, predictive]) => {
                const hpas = autoscaling?.hpas || [];
                const predictions = predictive?.predictions || [];
                if (hpas.length > 0 || predictions.length > 0) {
                    setInsights(deriveInsights(hpas, predictions));
                }
            });
        }
        load();
        const interval = setInterval(load, 15000);
        return () => clearInterval(interval);
    }, []);

    const visible = showAll ? insights : insights.slice(0, 5);
    return (
        <div className="rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3.5">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-semibold text-[#f7f8f8]">AI Capacity Insights</h3>
                <button onClick={() => setShowAll(s => !s)} className="text-[10px] text-[#7170ff] hover:text-[#79c0ff] transition-colors">{showAll ? "Show less" : "View all"}</button>
            </div>
            <div className="space-y-2">
                {visible.map((ins, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] hover:border-[rgba(15,23,42,0.14)] transition-colors">
                        <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: ins.impactColor, boxShadow: `0 0 4px ${ins.impactColor}` }} />
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-[#f7f8f8] font-medium leading-snug">{ins.text}</p>
                            <p className="text-[10px] text-[#64748b] mt-0.5">{ins.sub}</p>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="text-[10px] text-[#64748b] font-mono">Confidence</p>
                            <p className="text-[12px] font-bold text-[#3fb950] font-mono">{ins.confidence}%</p>
                        </div>
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0 mt-0.5" style={{ background: `${ins.impactColor}18`, color: ins.impactColor }}>
                            {ins.impact}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
