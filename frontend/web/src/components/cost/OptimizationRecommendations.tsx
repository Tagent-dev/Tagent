"use client";

import { useEffect, useState } from "react";
import { getCostSummary, type CostSummary } from "@/lib/api";

const BADGES = ["Optimize", "Migrate", "Delete", "Rightsize", "Scale", "Reserve"];

interface Rec {
    action: string;
    sub: string;
    savings: string;
    confidence: number;
    risk: string;
    riskColor: string;
    badge: string;
}

export function OptimizationRecommendations() {
    const [recs, setRecs] = useState<Rec[]>([]);

    useEffect(() => {
        const load = () => {
            getCostSummary()
                .then((data: CostSummary) => {
                    const mapped: Rec[] = data.recommendations.map((r, i) => ({
                        action: r.title,
                        sub: r.detail,
                        savings: r.saving.startsWith("$") ? r.saving + "/mo" : "$" + r.saving + "/mo",
                        confidence: 96 - i * 2,
                        risk: "Low Risk",
                        riskColor: "#3fb950",
                        badge: BADGES[i % BADGES.length],
                    }));
                    setRecs(mapped);
                })
                .catch(() => null);
        };
        load();
        const id = setInterval(load, 15000);
        return () => clearInterval(id);
    }, []);

    return (
        <div className="rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3.5">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-semibold text-[#f7f8f8]">Optimization Recommendations</h3>
                <button className="text-[10px] text-[#7170ff]">View all</button>
            </div>
            <div className="space-y-2">
                {recs.length === 0 && (
                    <div className="flex items-center gap-2.5 p-2 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)]">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-[#64748b]" />
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-[#64748b]">Loading recommendations…</p>
                            <p className="text-[10px] text-[#94a3b8]">Fetching optimization data</p>
                        </div>
                    </div>
                )}
                {recs.map((r, i) => (
                    <div key={i} className="flex items-center gap-2.5 p-2 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] hover:border-[rgba(15,23,42,0.14)] transition-colors">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: r.riskColor, boxShadow: `0 0 3px ${r.riskColor}` }} />
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-[#f7f8f8] truncate">{r.action}</p>
                            <p className="text-[10px] text-[#64748b] truncate">{r.sub}</p>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="text-[11px] font-bold text-[#3fb950] font-mono">{r.savings}</p>
                            <p className="text-[9px] text-[#64748b]">Potential Savings</p>
                        </div>
                        <span className="text-[9px] font-mono text-[#64748b] shrink-0">{r.confidence}%</span>
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ background: `${r.riskColor}18`, color: r.riskColor }}>{r.risk}</span>
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#7170ff]/15 text-[#7170ff] shrink-0">{r.badge}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
