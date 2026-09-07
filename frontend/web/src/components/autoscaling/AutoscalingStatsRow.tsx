"use client";

import { useEffect, useState } from "react";
import { getAutoscaling, getCostSummary, getRiskSummary, type AutoscalingSummary, type CostSummary, type RiskSummaryResponse } from "@/lib/api";

export function AutoscalingStatsRow() {
    const [autoscaling, setAutoscaling] = useState<AutoscalingSummary | null>(null);
    const [cost, setCost] = useState<CostSummary | null>(null);
    const [risk, setRisk] = useState<RiskSummaryResponse | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const [as, cs, rs] = await Promise.all([
                    getAutoscaling().catch(() => null),
                    getCostSummary().catch(() => null),
                    getRiskSummary().catch(() => null),
                ]);
                setAutoscaling(as);
                setCost(cs);
                setRisk(rs);
            } catch { }
        }
        load();
        const interval = setInterval(load, 15000);
        return () => clearInterval(interval);
    }, []);

    // Derive current replicas from HPAs
    const currentReplicas = autoscaling?.hpas?.reduce((sum, h) => sum + h.current, 0) || 0;
    // Derive scale events from events array
    const scaleEvents = autoscaling?.events?.length || 0;
    // Predicted scale events from HPAs nearing max
    const predictedScaleEvents = autoscaling?.hpas?.filter(h => h.current >= h.max * 0.8).length || 0;
    // Efficiency: ratio of current to desired capacity
    const totalDesired = autoscaling?.hpas?.reduce((sum, h) => sum + h.desired, 0) || 1;
    const efficiencyScore = autoscaling ? Math.round((Math.min(currentReplicas, totalDesired) / Math.max(totalDesired, 1)) * 100) : 0;
    // Resource savings from cost summary
    const resourceSavings = cost?.potential_savings || "—";
    // AI confidence from risk summary
    const aiConfidence = risk?.ai_confidence || 0;

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Current Replicas" value={autoscaling ? String(currentReplicas) : "—"} trend={autoscaling ? `${autoscaling.hpas?.length || 0} HPAs active` : ""} trendColor="#3fb950" color="#3fb950" />
            <StatCard label="Scale Events Today" value={autoscaling ? String(scaleEvents) : "—"} trend={scaleEvents > 0 ? "events recorded" : "no events"} trendColor="#f0883e" color="#7170ff" sparkline />
            <StatCard label="Predicted Scale Events" value={autoscaling ? String(predictedScaleEvents) : "—"} trend="HPAs near max capacity" trendColor="#64748b" color="#a371f7" />
            <StatCard label="Efficiency Score" value={autoscaling ? `${efficiencyScore}%` : "—"} trend={efficiencyScore >= 90 ? "Excellent" : efficiencyScore >= 70 ? "Good" : "Needs attention"} trendColor="#3fb950" color="#3fb950" ring={efficiencyScore} />
            <StatCard label="Resource Savings" value={resourceSavings} trend={cost ? "potential savings" : ""} trendColor="#3fb950" color="#22d3ee" />
            <StatCard label="AI Confidence" value={risk ? `${aiConfidence}%` : "—"} trend={aiConfidence >= 90 ? "High Confidence" : aiConfidence >= 70 ? "Moderate" : "Low"} trendColor="#3fb950" color="#a371f7" ring={aiConfidence} />
        </div>
    );
}

function StatCard({ label, value, trend, trendColor, color, ring, sparkline }: {
    label: string; value: string; trend: string; trendColor: string; color: string; ring?: number; sparkline?: boolean;
}) {
    const r = 18; const c = 2 * Math.PI * r;
    const offset = ring ? c - (ring / 100) * c : 0;
    return (
        <div className="rounded-[10px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3 hover:border-[rgba(15,23,42,0.14)] transition-colors" style={{ background: `radial-gradient(circle at 85% 25%, ${color}15 0%, transparent 55%), rgba(255,255,255,0.02)` }}>
            <p className="text-[10.5px] text-[#64748b] font-medium mb-1.5">{label}</p>
            <div className="flex items-end justify-between gap-2">
                <div>
                    <span className="text-[24px] font-bold text-[#f7f8f8] leading-none font-mono">{value}</span>
                    <p className="text-[10px] mt-1.5 font-medium" style={{ color: trendColor }}>{trend}</p>
                </div>
                {ring !== undefined && (
                    <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0">
                        <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(15,23,42,0.10)" strokeWidth="4" />
                        <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 22 22)" style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
                    </svg>
                )}
                {sparkline && (
                    <svg width="60" height="28" viewBox="0 0 60 20" className="shrink-0">
                        <polyline points="0,16 8,12 16,14 24,8 32,10 40,5 48,7 56,3 60,4" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                )}
            </div>
        </div>
    );
}
