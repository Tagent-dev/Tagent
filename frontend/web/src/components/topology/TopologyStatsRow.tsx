"use client";

import { useEffect, useState } from "react";
import { getClusterSummary, getServices, getRiskSummary, getMetricsSummary, type ClusterSummary, type ServiceInfo, type RiskSummaryResponse, type MetricsSummary } from "@/lib/api";

// ─── 4 stat cards: Cluster Health, Active Services, AI Confidence, Live Telemetry ───

interface StatsState {
    clusterHealth: number;
    healthLabel: string;
    activeServices: number;
    servicesGrowth: string;
    aiConfidence: number;
    confidenceLabel: string;
    telemetryEvents: string;
}

const INITIAL: StatsState = {
    clusterHealth: 0,
    healthLabel: "—",
    activeServices: 0,
    servicesGrowth: "—",
    aiConfidence: 0,
    confidenceLabel: "—",
    telemetryEvents: "—",
};

function deriveStats(
    summary: ClusterSummary | null,
    services: ServiceInfo[],
    riskSummary: RiskSummaryResponse | null,
    metrics: MetricsSummary | null,
): StatsState {
    let clusterHealth = 0;
    let healthLabel = "—";
    if (summary) {
        const nodeHealth = summary.total_nodes > 0 ? (summary.ready_nodes / summary.total_nodes) * 100 : 100;
        const podHealth = summary.total_pods > 0 ? (summary.running_pods / summary.total_pods) * 100 : 100;
        clusterHealth = Math.round(((nodeHealth + podHealth) / 2) * 10) / 10;
        healthLabel = clusterHealth >= 95 ? "Excellent" : clusterHealth >= 80 ? "Good" : clusterHealth >= 60 ? "Fair" : "Degraded";
    }

    const activeServices = services.length > 0 ? services.length : (summary?.total_services ?? 0);
    const servicesGrowth = services.length > 0 ? `${services.length} active` : "—";

    let aiConfidence = 0;
    let confidenceLabel = "—";
    if (riskSummary) {
        aiConfidence = riskSummary.ai_confidence || 0;
        confidenceLabel = aiConfidence >= 90 ? "High Confidence" : aiConfidence >= 70 ? "Moderate" : "Low Confidence";
    }

    let telemetryEvents = "—";
    if (summary && summary.running_pods > 0) {
        const estimated = summary.running_pods * 5000;
        if (estimated >= 1000000) telemetryEvents = `${(estimated / 1000000).toFixed(1)}M`;
        else if (estimated >= 1000) telemetryEvents = `${(estimated / 1000).toFixed(0)}K`;
        else telemetryEvents = `${estimated}`;
    }

    return { clusterHealth, healthLabel, activeServices, servicesGrowth, aiConfidence, confidenceLabel, telemetryEvents };
}

export function TopologyStatsRow() {
    const [stats, setStats] = useState<StatsState>(INITIAL);

    useEffect(() => {
        function fetchData() {
            Promise.all([
                getClusterSummary().catch(() => null),
                getServices().catch(() => []),
                getRiskSummary().catch(() => null),
                getMetricsSummary().catch(() => null),
            ]).then(([summary, services, riskSummary, metrics]) => {
                const derived = deriveStats(summary, services, riskSummary, metrics);
                setStats(derived);
            });
        }

        fetchData();
        const interval = setInterval(fetchData, 15000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <ClusterHealthCard score={stats.clusterHealth} label={stats.healthLabel} />
            <ActiveServicesCard count={stats.activeServices} growth={stats.servicesGrowth} />
            <AIConfidenceCard score={stats.aiConfidence} label={stats.confidenceLabel} />
            <LiveTelemetryCard events={stats.telemetryEvents} />
        </div>
    );
}

// ─── Card 1: Cluster Health Score (green ring + sparkline) ────────────

function ClusterHealthCard({ score, label }: { score: number; label: string }) {
    const r = 26;
    const c = 2 * Math.PI * r;
    const offset = c - (score / 100) * c;

    return (
        <div
            className="relative rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] overflow-hidden hover:border-[rgba(15,23,42,0.14)] transition-colors p-3.5"
            style={{ background: `radial-gradient(circle at 80% 30%, rgba(63, 185, 80, 0.12) 0%, transparent 55%), rgba(255,255,255,0.02)` }}
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3fb950" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                        </svg>
                        <span className="text-[12px] text-[#3fb950] font-semibold">Cluster Health Score</span>
                    </div>
                    <p className="text-[28px] font-bold text-[#f7f8f8] leading-none tracking-tight font-mono">{score}%</p>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#3fb950] mt-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950]" style={{ boxShadow: "0 0 4px #3fb950" }} />
                        {label}
                    </span>
                </div>
                <div className="shrink-0 relative">
                    <svg width="64" height="64" viewBox="0 0 64 64">
                        <defs>
                            <linearGradient id="ch-grad-t" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#3fb950" />
                                <stop offset="100%" stopColor="#22d3ee" />
                            </linearGradient>
                        </defs>
                        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(15,23,42,0.10)" strokeWidth="5" />
                        <circle cx="32" cy="32" r={r} fill="none" stroke="url(#ch-grad-t)" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 32 32)" style={{ filter: "drop-shadow(0 0 4px rgba(63,185,80,0.6))" }} />
                    </svg>
                </div>
            </div>
            <div className="h-[28px] mt-1 -mx-1">
                <Sparkline points="0,18 12,16 24,15 36,12 48,13 60,9 72,10 84,7 96,8 108,5 120,7 132,3 144,5 156,2 168,4" color="#3fb950" />
            </div>
        </div>
    );
}

// ─── Card 2: Active Services + cyan sparkline ───────────────────────────

function ActiveServicesCard({ count, growth }: { count: number; growth: string }) {
    return (
        <div
            className="relative rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] overflow-hidden hover:border-[rgba(15,23,42,0.14)] transition-colors p-3.5"
            style={{ background: `radial-gradient(circle at 80% 30%, rgba(34, 211, 238, 0.14) 0%, transparent 55%), rgba(255,255,255,0.02)` }}
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <line x1="3" y1="9" x2="21" y2="9" />
                            <line x1="9" y1="21" x2="9" y2="9" />
                        </svg>
                        <span className="text-[12px] text-[#22d3ee] font-semibold">Active Services</span>
                    </div>
                    <p className="text-[28px] font-bold text-[#f7f8f8] leading-none tracking-tight font-mono">{count || "—"}</p>
                    <p className="text-[11px] text-[#3fb950] mt-1.5 font-medium">{growth}</p>
                </div>
                <div className="shrink-0 w-12 h-12 rounded-lg bg-[#22d3ee]/10 border border-[#22d3ee]/30 flex items-center justify-center" style={{ filter: "drop-shadow(0 0 6px rgba(34,211,238,0.4))" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                        <line x1="12" y1="22.08" x2="12" y2="12" />
                    </svg>
                </div>
            </div>
            <div className="h-[28px] mt-1 -mx-1">
                <Sparkline points="0,16 12,14 24,15 36,11 48,13 60,8 72,10 84,6 96,8 108,4 120,6 132,2 144,4 156,1 168,3" color="#22d3ee" />
            </div>
        </div>
    );
}

// ─── Card 3: AI Confidence Score with purple ring ─────────────────────

function AIConfidenceCard({ score, label }: { score: number; label: string }) {
    const r = 26;
    const c = 2 * Math.PI * r;
    const offset = c - (score / 100) * c;

    return (
        <div
            className="relative rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] overflow-hidden hover:border-[rgba(15,23,42,0.14)] transition-colors p-3.5"
            style={{ background: `radial-gradient(circle at 80% 30%, rgba(163, 113, 247, 0.14) 0%, transparent 55%), rgba(255,255,255,0.02)` }}
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="#a371f7"><path d="M12 0L14 9L24 12L14 15L12 24L10 15L0 12L10 9Z" /></svg>
                        <span className="text-[12px] text-[#a371f7] font-semibold">AI Confidence Score</span>
                    </div>
                    <p className="text-[28px] font-bold text-[#f7f8f8] leading-none tracking-tight font-mono">{score}%</p>
                    <p className="text-[11px] text-[#a371f7] mt-1.5 font-medium">{label}</p>
                </div>
                <div className="shrink-0 relative">
                    <svg width="64" height="64" viewBox="0 0 64 64">
                        <defs>
                            <linearGradient id="aic-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#a371f7" />
                                <stop offset="100%" stopColor="#ec4899" />
                            </linearGradient>
                        </defs>
                        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(15,23,42,0.10)" strokeWidth="5" />
                        <circle cx="32" cy="32" r={r} fill="none" stroke="url(#aic-grad)" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 32 32)" style={{ filter: "drop-shadow(0 0 4px rgba(163,113,247,0.6))" }} />
                    </svg>
                </div>
            </div>
            <div className="h-[28px] mt-1 -mx-1">
                <Sparkline points="0,14 12,12 24,15 36,10 48,13 60,8 72,11 84,5 96,9 108,3 120,7 132,2 144,5 156,1 168,4" color="#a371f7" />
            </div>
        </div>
    );
}

// ─── Card 4: Live Telemetry + bar chart ─────────────────────────────────

function LiveTelemetryCard({ events }: { events: string }) {
    return (
        <div
            className="relative rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] overflow-hidden hover:border-[rgba(15,23,42,0.14)] transition-colors p-3.5"
            style={{ background: `radial-gradient(circle at 80% 30%, rgba(63, 185, 80, 0.10) 0%, transparent 55%), rgba(255,255,255,0.02)` }}
        >
            <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-1.5">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3fb950" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                    <span className="text-[12px] text-[#3fb950] font-semibold">Live Telemetry</span>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] text-[#3fb950] font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950]" style={{ boxShadow: "0 0 4px #3fb950", animation: "wi-pulse 1.4s infinite" }} />
                </span>
            </div>
            <p className="text-[28px] font-bold text-[#f7f8f8] leading-none tracking-tight font-mono">{events}</p>
            <p className="text-[11px] text-[#64748b] mt-1.5">Events / min <span className="text-[#3fb950]">●</span></p>
            <div className="h-[36px] mt-1.5 -mx-1">
                <BarChart color="#3fb950" />
            </div>
        </div>
    );
}

// ─── Sparkline + Bar Chart ───────────────────────────────────────────────────

function Sparkline({ points, color }: { points: string; color: string }) {
    const id = color.replace("#", "");
    return (
        <svg width="100%" height="28" viewBox="0 0 168 22" preserveAspectRatio="none" className="overflow-visible">
            <defs>
                <linearGradient id={`tspark-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={color} stopOpacity="0.4" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <polygon points={`${points} 168,22 0,22`} fill={`url(#tspark-${id})`} />
            <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" style={{ filter: "blur(1.5px)" }} />
            <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function BarChart({ color }: { color: string }) {
    const heights = [6, 10, 8, 12, 9, 14, 11, 16, 13, 18, 15, 12, 16, 19, 14, 17, 20, 16, 18, 14, 19, 16, 21, 17, 14, 18, 22, 16, 19, 14];
    return (
        <svg width="100%" height="36" viewBox="0 0 168 24" preserveAspectRatio="none">
            <defs>
                <linearGradient id="tbar" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={color} stopOpacity="1" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.3" />
                </linearGradient>
            </defs>
            {heights.map((h, i) => (
                <rect
                    key={i}
                    x={i * 5.6 + 0.5}
                    y={24 - h}
                    width="4"
                    height={h}
                    rx="0.5"
                    fill="url(#tbar)"
                    opacity={0.6 + (h / 22) * 0.4}
                />
            ))}
        </svg>
    );
}
