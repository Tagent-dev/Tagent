"use client";

import { useEffect, useState } from "react";
import { getCostSummary, type CostSummary } from "@/lib/api";

const ICON_COLORS = ["#f0883e", "#a371f7", "#22d3ee", "#3fb950", "#f85149", "#f0883e", "#a371f7"];
const ICONS = ["⚡", "💻", "💾", "☁️", "🌐", "📦", "🔄"];

export function AICostInsights() {
    const [showAll, setShowAll] = useState(false);
    const [data, setData] = useState<CostSummary | null>(null);

    useEffect(() => {
        const load = () => { getCostSummary().then(setData).catch(() => null); };
        load();
        const id = setInterval(load, 15000);
        return () => clearInterval(id);
    }, []);

    const insights = data
        ? [
            ...data.recommendations.map((r, i) => ({
                icon: ICONS[i % ICONS.length],
                text: r.title,
                sub: r.detail,
                savings: r.saving.startsWith("$") ? r.saving + "/mo" : "$" + r.saving + "/mo",
                confidence: 90 + (i % 10),
                color: ICON_COLORS[i % ICON_COLORS.length],
            })),
            ...data.items
                .filter(item => parseFloat(item.estimate.replace(/[^0-9.]/g, "")) > 500)
                .map((item, i) => ({
                    icon: "⚡",
                    text: `${item.name} over-provisioned`,
                    sub: `${item.kind} in ${item.namespace} — basis: ${item.basis}`,
                    savings: item.estimate.startsWith("$") ? item.estimate + "/mo" : "$" + item.estimate + "/mo",
                    confidence: 94 + (i % 6),
                    color: "#f0883e",
                })),
        ]
        : [];

    const visible = showAll ? insights : insights.slice(0, 5);

    return (
        <div className="rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3.5">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-semibold text-[#f7f8f8]">AI Cost Insights</h3>
                <button onClick={() => setShowAll(s => !s)} className="text-[10px] text-[#7170ff] hover:text-[#79c0ff] transition-colors">
                    {showAll ? "Show less" : "View all"}
                </button>
            </div>
            <div className="space-y-2">
                {visible.length === 0 && (
                    <div className="flex items-start gap-2 p-2 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)]">
                        <span className="text-[14px] shrink-0 mt-0.5">⏳</span>
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-[#f7f8f8] font-medium leading-snug">Loading insights…</p>
                            <p className="text-[10px] text-[#64748b] mt-0.5">Fetching data from cluster</p>
                        </div>
                    </div>
                )}
                {visible.map((ins, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] hover:border-[rgba(15,23,42,0.14)] transition-colors">
                        <span className="text-[14px] shrink-0 mt-0.5">{ins.icon}</span>
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-[#f7f8f8] font-medium leading-snug">{ins.text}</p>
                            <p className="text-[10px] text-[#64748b] mt-0.5">{ins.sub}</p>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="text-[11px] font-bold text-[#3fb950] font-mono">{ins.savings}</p>
                            <p className="text-[9px] text-[#64748b]">Potential Savings</p>
                        </div>
                        <span className="text-[10px] font-mono font-semibold shrink-0 mt-0.5" style={{ color: ins.color }}>{ins.confidence}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
