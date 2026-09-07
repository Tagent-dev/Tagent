"use client";

import { useEffect, useState } from "react";
import { getFleetSummary, type FleetSummaryResponse } from "@/lib/api";

export function ClusterStatsRow() {
    const [summary, setSummary] = useState<FleetSummaryResponse | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const data = await getFleetSummary();
                setSummary(data);
            } catch { }
        }
        load();
        const interval = setInterval(load, 15000);
        return () => clearInterval(interval);
    }, []);

    const s = summary;

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Connected Clusters" value={s ? String(s.total_clusters) : "—"} trend={s ? `${s.healthy_clusters} healthy` : ""} trendColor="#3fb950" color="#3fb950" />
            <StatCard label="Fleet Health Score" value={s ? s.fleet_health_score.toFixed(1) : "—"} suffix="/100" badge={s && s.fleet_health_score >= 80 ? "Excellent" : s && s.fleet_health_score >= 50 ? "Warning" : "Critical"} color={s && s.fleet_health_score >= 80 ? "#3fb950" : "#f0883e"} ring={s ? s.fleet_health_score : 0} />
            <StatCard label="Active Workloads" value={s ? String(s.total_workloads) : "—"} trend={s ? `${s.total_nodes} nodes` : ""} trendColor="#3fb950" color="#22d3ee" />
            <StatCard label="Open Incidents" value={s ? String(s.total_incidents) : "0"} trend={s && s.critical_clusters > 0 ? `${s.critical_clusters} critical clusters` : "All clear"} trendColor={s && s.total_incidents > 0 ? "#f0883e" : "#3fb950"} color="#f85149" />
            <StatCard label="AI Confidence" value={s ? String(s.ai_confidence) : "—"} suffix="%" badge="High Confidence" color="#a371f7" ring={s ? s.ai_confidence : 0} />
            <StatCard label="Total Pods" value={s ? String(s.total_pods) : "—"} trend={s ? `across ${s.total_clusters} clusters` : ""} trendColor="#3fb950" color="#3fb950" sparkline />
        </div>
    );
}

function StatCard({ label, value, suffix, trend, trendColor, badge, color, ring, sparkline }: {
    label: string; value: string; suffix?: string; trend?: string; trendColor?: string;
    badge?: string; color: string; ring?: number; sparkline?: boolean;
}) {
    const r = 22;
    const c = 2 * Math.PI * r;
    const offset = ring ? c - (ring / 100) * c : c;

    return (
        <div className="rounded-[10px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3 hover:border-[rgba(15,23,42,0.14)] transition-colors" style={{ background: `radial-gradient(circle at 85% 25%, ${color}18 0%, transparent 55%), rgba(255,255,255,0.02)` }}>
            <p className="text-[10.5px] text-[#64748b] font-medium mb-1.5">{label}</p>
            <div className="flex items-end justify-between gap-2">
                <div>
                    <div className="flex items-baseline gap-0.5">
                        <span className="text-[24px] font-bold text-[#f7f8f8] leading-none font-mono">{value}</span>
                        {suffix && <span className="text-[12px] text-[#94a3b8] font-medium">{suffix}</span>}
                    </div>
                    {trend && <p className="text-[10px] mt-1.5 font-medium" style={{ color: trendColor }}>{trend}</p>}
                    {badge && <p className="text-[10px] mt-1.5 font-semibold" style={{ color }}>✓ {badge}</p>}
                </div>
                {ring != null && ring > 0 && (
                    <svg width="48" height="48" viewBox="0 0 48 48" className="shrink-0">
                        <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(15,23,42,0.10)" strokeWidth="4" />
                        <circle cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 24 24)" style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
                    </svg>
                )}
                {sparkline && (
                    <svg width="60" height="28" viewBox="0 0 60 20" className="shrink-0">
                        <polyline points="0,16 8,14 16,12 24,14 32,8 40,10 48,5 56,7 60,3" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                )}
            </div>
        </div>
    );
}
