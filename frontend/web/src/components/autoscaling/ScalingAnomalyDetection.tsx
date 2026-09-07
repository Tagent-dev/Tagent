"use client";

import { useEffect, useState } from "react";
import { getPredictivePredictions } from "@/lib/api";

// ─── Scaling Anomaly Detection (compact card layout) ─────────────────────────

const FALLBACK_ANOMALIES = [
    { icon: "warning", title: "Unexpected scale spike", sub: "API Engine scaled 3x in 8 minutes", confidence: 95, color: "#f0883e" },
    { icon: "oscillate", title: "Oscillating replicas", sub: "", confidence: 91, color: "#f85149" },
    { icon: "frequency", title: "High scale event frequency", sub: "", confidence: 86, color: "#f0883e" },
    { icon: "flapping", title: "CPU threshold flapping", sub: "", confidence: 93, color: "#f85149" },
];

function issueColor(probability: number): string {
    if (probability >= 0.9) return "#f85149";
    if (probability >= 0.7) return "#f0883e";
    return "#7170ff";
}

export function ScalingAnomalyDetection() {
    const [anomalies, setAnomalies] = useState<typeof FALLBACK_ANOMALIES>([]);

    useEffect(() => {
        let active = true;
        const fetchData = () => {
            getPredictivePredictions()
                .then((data) => {
                    if (!active) return;
                    const mapped = data.predictions.slice(0, 4).map((p, i) => ({
                        icon: i === 0 ? "warning" : i === 1 ? "oscillate" : i === 2 ? "frequency" : "flapping",
                        title: p.predicted_issue,
                        sub: i === 0 ? `${p.resource} — ${p.preventive_action}` : "",
                        confidence: Math.round(p.probability * 100),
                        color: issueColor(p.probability),
                    }));
                    if (mapped.length > 0) setAnomalies(mapped);
                })
                .catch(() => { });
        };
        fetchData();
        const interval = setInterval(fetchData, 15_000);
        return () => { active = false; clearInterval(interval); };
    }, []);
    return (
        <div className="rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3.5">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-semibold text-[#f7f8f8]">Scaling Anomaly Detection</h3>
                <button className="text-[10px] text-[#64748b] px-2 py-0.5 rounded-md border border-[rgba(15,23,42,0.14)] hover:text-[#f7f8f8] hover:border-[rgba(15,23,42,0.20)] transition-colors">View all</button>
            </div>

            {/* Main anomaly (featured) */}
            <div className="flex items-start gap-3 mb-3 p-2.5 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)]">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: `${anomalies[0]?.color ?? "#f0883e"}20`, border: `2px solid ${anomalies[0]?.color ?? "#f0883e"}` }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={anomalies[0]?.color ?? "#f0883e"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-[#f7f8f8]">{anomalies[0]?.title}</p>
                    <p className="text-[10.5px] text-[#64748b] mt-0.5">{anomalies[0]?.sub}</p>
                </div>
                <div className="text-right shrink-0">
                    <p className="text-[9px] text-[#64748b]">Confidence</p>
                    <p className="text-[16px] font-bold text-[#f7f8f8] font-mono">{anomalies[0]?.confidence}%</p>
                </div>
            </div>

            {/* Secondary anomalies (compact list) */}
            <div className="space-y-1.5 mb-3">
                {anomalies.slice(1).map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10.5px]">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: a.color, boxShadow: `0 0 4px ${a.color}` }} />
                        <span className="text-[#f7f8f8] flex-1">{a.title}</span>
                        <span className="text-[#64748b] font-mono shrink-0">{a.confidence}%</span>
                    </div>
                ))}
            </div>

            {/* Root Cause section */}
            {anomalies.length > 0 && (
                <div className="pt-3 border-t border-[rgba(15,23,42,0.10)]">
                    <p className="text-[10px] text-[#64748b] font-semibold mb-1">Root Cause</p>
                    <p className="text-[11px] text-[#f7f8f8]">{anomalies[0]?.sub || "—"}</p>
                    <p className="text-[10px] text-[#64748b] mt-1.5">Affected</p>
                    <p className="text-[11px] text-[#f7f8f8]">{anomalies[0]?.title || "—"}</p>
                    <p className="text-[10px] text-[#64748b] mt-1.5">Recommended Action</p>
                    <p className="text-[11px] text-[#f7f8f8]">Investigate and remediate</p>
                    <button className="mt-2.5 px-3 py-1.5 rounded-md text-[10px] font-semibold text-white" style={{ background: "linear-gradient(135deg, #f0883e, #f85149)", boxShadow: "0 0 8px rgba(248,81,73,0.3)" }}>
                        Investigate
                    </button>
                </div>
            )}
        </div>
    );
}
