"use client";

import { useEffect, useState } from "react";
import { getDeployments, getRiskSummary, type DeploymentInfo, type RiskSummaryResponse } from "@/lib/api";

export function DeploymentStatsRow() {
    const [deployments, setDeployments] = useState<DeploymentInfo[]>([]);
    const [riskSummary, setRiskSummary] = useState<RiskSummaryResponse | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const [deps, risk] = await Promise.all([
                    getDeployments().catch(() => []),
                    getRiskSummary().catch(() => null),
                ]);
                setDeployments(deps || []);
                setRiskSummary(risk);
            } catch { }
        }
        load();
        const interval = setInterval(load, 15000);
        return () => clearInterval(interval);
    }, []);

    const total = deployments.length;
    const healthy = deployments.filter(d => d.ready === d.replicas && d.replicas > 0).length;
    const degraded = deployments.filter(d => d.ready < d.replicas && d.ready > 0).length;
    const rolloutsInProgress = deployments.filter(d => d.available < d.replicas).length;
    const riskScore = riskSummary?.overall_score || 0;
    const riskLevel = riskSummary?.overall_level || "low";
    const incidentExposure = riskSummary?.total_services_at_risk || 0;

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Active Deployments" value={total > 0 ? String(total) : "—"} trend={total > 0 ? `across ${new Set(deployments.map(d => d.namespace)).size} namespaces` : ""} trendColor="#3fb950" color="#3fb950" />
            <StatCard label="Healthy Deployments" value={total > 0 ? String(healthy) : "—"} badge={total > 0 ? `${Math.round((healthy / total) * 100)}% of total` : ""} color="#3fb950" />
            <StatCard label="Degraded Deployments" value={total > 0 ? String(degraded) : "—"} badge={total > 0 ? `${Math.round((degraded / total) * 100)}% of total` : ""} color="#f0883e" />
            <StatCard label="Rollouts In Progress" value={String(rolloutsInProgress)} trend={rolloutsInProgress > 0 ? "active now" : "all stable"} trendColor="#22d3ee" color="#22d3ee" />
            <StatCard label="AI Risk Score" value={riskSummary ? String(riskScore) : "—"} badge={riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1) + " Risk"} color={riskScore > 60 ? "#f85149" : riskScore > 30 ? "#f0883e" : "#3fb950"} ring={riskScore} ringMax={100} />
            <StatCard label="Incident Exposure Score" value={String(incidentExposure)} badge={incidentExposure <= 3 ? "Low Exposure" : incidentExposure <= 7 ? "Medium" : "High Exposure"} color="#a371f7" ring={Math.min(incidentExposure * 10, 100)} ringMax={100} />
        </div>
    );
}

function StatCard({ label, value, trend, trendColor, badge, color, ring, ringMax }: {
    label: string; value: string; trend?: string; trendColor?: string;
    badge?: string; color: string; ring?: number; ringMax?: number;
}) {
    const r = 20;
    const c = 2 * Math.PI * r;
    const offset = ring !== undefined && ringMax ? c - (ring / ringMax) * c : 0;

    return (
        <div className="rounded-[10px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3 hover:border-[rgba(15,23,42,0.14)] transition-colors" style={{ background: `radial-gradient(circle at 85% 25%, ${color}15 0%, transparent 55%), rgba(255,255,255,0.02)` }}>
            <p className="text-[10.5px] text-[#64748b] font-medium mb-1.5">{label}</p>
            <div className="flex items-end justify-between gap-2">
                <div>
                    <span className="text-[24px] font-bold text-[#f7f8f8] leading-none font-mono">{value}</span>
                    {trend && <p className="text-[10px] mt-1.5 font-medium" style={{ color: trendColor }}>{trend}</p>}
                    {badge && <p className="text-[10px] mt-1.5 font-semibold" style={{ color }}>{badge}</p>}
                </div>
                {ring !== undefined && (
                    <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0">
                        <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(15,23,42,0.10)" strokeWidth="4" />
                        <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 22 22)" style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
                    </svg>
                )}
            </div>
        </div>
    );
}
