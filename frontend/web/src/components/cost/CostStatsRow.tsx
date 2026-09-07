"use client";

import { useEffect, useState } from "react";
import { getCostSummary, type CostSummary } from "@/lib/api";

export function CostStatsRow() {
    const [data, setData] = useState<CostSummary | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const d = await getCostSummary();
                setData(d);
            } catch { }
        }
        load();
        const interval = setInterval(load, 15000);
        return () => clearInterval(interval);
    }, []);

    const monthlySpend = data?.monthly_spend || "—";
    const potentialSavings = data?.potential_savings || "—";
    const itemCount = data?.items?.length || 0;
    const recCount = data?.recommendations?.length || 0;

    // Derive efficiency score from savings vs spend
    let efficiencyScore = 0;
    if (data) {
        const spend = parseFloat(data.monthly_spend.replace(/[^0-9.]/g, "")) || 1;
        const savings = parseFloat(data.potential_savings.replace(/[^0-9.]/g, "")) || 0;
        efficiencyScore = Math.round(((spend - savings) / spend) * 100);
    }

    // Derive idle resources from items with low cost basis
    const idleResources = data?.items?.filter(i => i.basis === "idle" || i.basis.includes("unused")).length || 0;

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Monthly Spend" value={monthlySpend} trend={data ? `${itemCount} tracked resources` : ""} trendColor="#f0883e" icon="dollar" color="#7170ff" />
            <StatCard label="Potential Savings" value={potentialSavings} trend={data ? `${recCount} opportunities` : ""} trendColor="#3fb950" icon="trending" color="#3fb950" />
            <StatCard label="Efficiency Score" value={data ? `${efficiencyScore}%` : "—"} trend={data ? "AI calculated" : ""} trendColor="#3fb950" icon="gauge" color="#a371f7" ring={efficiencyScore} />
            <StatCard label="Idle Resources" value={data ? String(idleResources) : "—"} trend={data ? "detected by AI" : ""} trendColor="#3fb950" icon="pause" color="#f0883e" />
            <StatCard label="Tracked Items" value={data ? String(itemCount) : "—"} trend={data ? "across all namespaces" : ""} trendColor="#f0883e" icon="chart" color="#22d3ee" />
            <StatCard label="Optimization Opportunities" value={data ? String(recCount) : "—"} trend={data ? "AI recommendations" : ""} trendColor="#3fb950" icon="target" color="#3fb950" ring={recCount > 0 ? Math.min(recCount * 10, 100) : 0} />
        </div>
    );
}

function StatCard({ label, value, trend, trendColor, icon, color, ring }: {
    label: string; value: string; trend: string; trendColor: string; icon: string; color: string; ring?: number;
}) {
    const r = 18; const c = 2 * Math.PI * r;
    const offset = ring ? c - (ring / 100) * c : 0;
    return (
        <div className="rounded-[10px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3 hover:border-[rgba(15,23,42,0.14)] transition-colors" style={{ background: `radial-gradient(circle at 85% 25%, ${color}15 0%, transparent 55%), rgba(255,255,255,0.02)` }}>
            <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10.5px] text-[#64748b] font-medium">{label}</p>
                <IconSmall icon={icon} color={color} />
            </div>
            <p className="text-[22px] font-bold text-[#f7f8f8] leading-none font-mono">{value}</p>
            <p className="text-[10px] mt-1.5 font-medium" style={{ color: trendColor }}>{trend}</p>
            {ring !== undefined && ring > 0 && (
                <div className="mt-2">
                    <svg width="100%" height="4" viewBox="0 0 100 4" preserveAspectRatio="none">
                        <rect x="0" y="0" width="100" height="4" rx="2" fill="rgba(15,23,42,0.10)" />
                        <rect x="0" y="0" width={ring} height="4" rx="2" fill={color} style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
                    </svg>
                </div>
            )}
        </div>
    );
}

function IconSmall({ icon, color }: { icon: string; color: string }) {
    return (
        <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${color}20` }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {icon === "dollar" && <><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>}
                {icon === "trending" && <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>}
                {icon === "gauge" && <><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></>}
                {icon === "pause" && <><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>}
                {icon === "chart" && <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>}
                {icon === "target" && <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>}
            </svg>
        </div>
    );
}
