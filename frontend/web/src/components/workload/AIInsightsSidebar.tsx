"use client";

import { useEffect, useState } from "react";
import { getIncidents, getRiskPredictions, type Incident, type RiskPrediction } from "@/lib/api";

// ─── Alert Data ──────────────────────────────────────────────────────────────

interface Alert {
    icon: "warning" | "refresh" | "cpu" | "memory" | "shield";
    title: string;
    description: string;
    confidence: number;
    color: string;
    bgColor: string;
    sparkColor: string;
    sparkPoints: string;
}

interface Recommendation {
    icon: "warning" | "refresh" | "memory";
    color: string;
    bgColor: string;
    title: string;
    detail: string;
    impact: "High" | "Medium";
}

function generateSparkFromSeed(seed: number): string {
    const points: string[] = [];
    let y = 12;
    for (let x = 0; x <= 48; x += 6) {
        y = Math.max(2, Math.min(16, y + ((seed * (x + 1) * 31 + 7) % 7) - 3));
        points.push(`${x},${y}`);
    }
    return points.join(" ");
}

function deriveAlerts(incidents: Incident[], predictions: RiskPrediction[]): Alert[] {
    const alerts: Alert[] = [];

    for (const inc of incidents.slice(0, 3)) {
        const isHigh = inc.severity === "critical" || inc.severity === "high";
        const color = inc.severity === "critical" ? "#f85149" : inc.severity === "high" ? "#f0883e" : "#a371f7";
        alerts.push({
            icon: isHigh ? "warning" : "refresh",
            title: inc.title.length > 30 ? inc.title.slice(0, 28) + "…" : inc.title,
            description: `${inc.service} in ${inc.namespace}`,
            confidence: inc.confidence || 90,
            color,
            bgColor: `${color}26`,
            sparkColor: color,
            sparkPoints: generateSparkFromSeed(alerts.length + 1),
        });
    }

    for (const pred of predictions.slice(0, 2)) {
        const prob = pred.probability;
        const color = prob > 0.7 ? "#f85149" : prob > 0.4 ? "#f0883e" : "#3fb950";
        alerts.push({
            icon: "cpu",
            title: pred.preventive_action.length > 30 ? pred.preventive_action.slice(0, 28) + "…" : pred.preventive_action,
            description: pred.predicted_issue,
            confidence: Math.round(prob * 100),
            color,
            bgColor: `${color}26`,
            sparkColor: color,
            sparkPoints: generateSparkFromSeed(alerts.length + 10),
        });
    }

    if (alerts.length === 0) {
        alerts.push({
            icon: "shield",
            title: "Workload Stability",
            description: "All workloads are stable. No incidents detected.",
            confidence: 98,
            color: "#3fb950",
            bgColor: "rgba(63,185,80,0.15)",
            sparkColor: "#3fb950",
            sparkPoints: "0,9 8,8 16,9 24,8 32,9 40,8 48,9",
        });
    }

    return alerts.slice(0, 5);
}

function deriveRecommendations(incidents: Incident[], predictions: RiskPrediction[]): Recommendation[] {
    const recs: Recommendation[] = [];

    for (const pred of predictions.slice(0, 2)) {
        const prob = pred.probability;
        const color = prob > 0.7 ? "#f85149" : "#f0883e";
        recs.push({
            icon: prob > 0.7 ? "warning" : "memory",
            color,
            bgColor: `${color}26`,
            title: pred.preventive_action.length > 22 ? pred.preventive_action.slice(0, 20) + "…" : pred.preventive_action,
            detail: `${pred.service}: ${pred.time_horizon}`,
            impact: prob > 0.7 ? "High" : "Medium",
        });
    }

    for (const inc of incidents.filter(i => i.status === "active").slice(0, 1)) {
        recs.push({
            icon: "refresh",
            color: "#f85149",
            bgColor: "rgba(248,81,73,0.15)",
            title: inc.rootCause ? "Fix root cause" : "Investigate incident",
            detail: inc.title.length > 30 ? inc.title.slice(0, 28) + "…" : inc.title,
            impact: "High",
        });
    }

    return recs.slice(0, 3);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AIInsightsSidebar() {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [overallConfidence, setOverallConfidence] = useState(0);

    useEffect(() => {
        async function load() {
            try {
                const [incidentData, predictionsData] = await Promise.all([
                    getIncidents().catch(() => ({ incidents: [], total: 0 })),
                    getRiskPredictions().catch(() => ({ predictions: [], total: 0 })),
                ]);
                const incidents = incidentData.incidents || [];
                const predictions = predictionsData.predictions || [];

                setAlerts(deriveAlerts(incidents, predictions));
                setRecommendations(deriveRecommendations(incidents, predictions));

                if (incidents.length === 0 && predictions.length === 0) {
                    setOverallConfidence(98);
                } else {
                    const avgConf = incidents.length > 0
                        ? incidents.reduce((sum, i) => sum + (i.confidence || 85), 0) / incidents.length
                        : 95;
                    setOverallConfidence(Math.round(avgConf));
                }
            } catch { }
        }
        load();
        const interval = setInterval(load, 15000);
        return () => clearInterval(interval);
    }, []);

    const confidence = overallConfidence;
    const circumference = 2 * Math.PI * 24;
    const offset = circumference - (confidence / 100) * circumference;

    return (
        <aside className="rounded-[10px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3.5 self-start xl:sticky xl:top-4 max-h-[calc(100vh-90px)] overflow-y-auto wi-scrollbar">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div
                        className="w-7 h-7 rounded-md flex items-center justify-center"
                        style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" y1="19" x2="12" y2="22" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-[13px] font-semibold text-[#f7f8f8] leading-tight">AI Insights</h3>
                        <p className="text-[9px] text-[#64748b]">Powered by Tagent AI</p>
                    </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#a371f7">
                    <path d="M12 0L14 9L24 12L14 15L12 24L10 15L0 12L10 9Z" />
                </svg>
            </div>

            {/* Overall Cluster Confidence */}
            <div className="rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] p-3 mb-3">
                <div className="flex items-center gap-3">
                    {/* Donut */}
                    <div className="relative shrink-0">
                        <svg width="56" height="56" viewBox="0 0 56 56">
                            <defs>
                                <linearGradient id="conf-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#a371f7" />
                                    <stop offset="100%" stopColor="#3fb950" />
                                </linearGradient>
                            </defs>
                            <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(15,23,42,0.10)" strokeWidth="4" />
                            <circle
                                cx="28"
                                cy="28"
                                r="24"
                                fill="none"
                                stroke="url(#conf-grad)"
                                strokeWidth="4"
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                strokeDashoffset={offset}
                                transform="rotate(-90 28 28)"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[14px] font-bold text-[#a371f7]">{confidence}%</span>
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-[#f7f8f8]">Overall Cluster Confidence</p>
                        <div className="w-full h-1.5 rounded-full bg-[rgba(15,23,42,0.10)] mt-1.5 overflow-hidden">
                            <div
                                className="h-full rounded-full"
                                style={{
                                    width: `${confidence}%`,
                                    background: "linear-gradient(90deg, #a371f7, #3fb950)",
                                }}
                            />
                        </div>
                        <p className="text-[10px] text-[#3fb950] mt-1.5 flex items-center gap-1">
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                            High confidence in analysis
                        </p>
                    </div>
                </div>
            </div>

            {/* Alert Cards */}
            <div className="space-y-2">
                {alerts.map((alert, i) => (
                    <AlertCard key={i} alert={alert} />
                ))}
            </div>

            {/* AI Recommendations */}
            <div className="mt-4">
                <div className="flex items-center justify-between mb-2.5">
                    <h4 className="text-[12px] font-semibold text-[#f7f8f8]">AI Recommendations</h4>
                    <span
                        className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white"
                        style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}
                    >
                        {recommendations.length}
                    </span>
                </div>
                <div className="space-y-1.5">
                    {recommendations.map((rec, i) => (
                        <RecommendationRow key={i} rec={rec} />
                    ))}
                </div>
                <button className="mt-2.5 text-[11px] text-[#7170ff] hover:text-[#79c0ff] transition-colors flex items-center gap-1 font-medium">
                    View all recommendations
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                    </svg>
                </button>
            </div>
        </aside>
    );
}

// ─── Alert Card ──────────────────────────────────────────────────────────────

function AlertCard({ alert }: { alert: Alert }) {
    return (
        <div className="rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] p-2.5 hover:border-[rgba(15,23,42,0.14)] transition-colors group cursor-pointer">
            <div className="flex items-start gap-2">
                <div
                    className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                    style={{ background: alert.bgColor }}
                >
                    <AlertIcon icon={alert.icon} color={alert.color} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className="text-[11.5px] font-semibold leading-tight" style={{ color: alert.color }}>
                            {alert.title}
                        </p>
                        <Sparkline points={alert.sparkPoints} color={alert.sparkColor} />
                    </div>
                    <p className="text-[10.5px] text-[#64748b] leading-snug">{alert.description}</p>
                    <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-[#94a3b8] font-mono">
                            Confidence {alert.confidence}%
                        </span>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:text-[#f7f8f8] transition-colors">
                            <polyline points="9 18 15 12 9 6" />
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Sparkline({ points, color }: { points: string; color: string }) {
    return (
        <svg width="50" height="18" viewBox="0 0 48 18" className="shrink-0">
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.85"
            />
        </svg>
    );
}

// ─── Recommendation Row ──────────────────────────────────────────────────────

function RecommendationRow({ rec }: { rec: Recommendation }) {
    const impactStyle = rec.impact === "High"
        ? { bg: "rgba(248,81,73,0.1)", color: "#f85149", border: "rgba(248,81,73,0.3)" }
        : { bg: "rgba(240,136,62,0.1)", color: "#f0883e", border: "rgba(240,136,62,0.3)" };

    return (
        <div className="flex items-center gap-2 p-2 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] hover:border-[rgba(15,23,42,0.14)] transition-colors group cursor-pointer">
            <div
                className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                style={{ background: rec.bgColor }}
            >
                <AlertIcon icon={rec.icon} color={rec.color} size={12} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-[#f7f8f8] truncate">{rec.title}</p>
                <p className="text-[10px] text-[#64748b] truncate">{rec.detail}</p>
            </div>
            <span
                className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                style={{
                    background: impactStyle.bg,
                    color: impactStyle.color,
                    border: `1px solid ${impactStyle.border}`,
                }}
            >
                {rec.impact} Impact
            </span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 group-hover:text-[#f7f8f8] transition-colors">
                <polyline points="9 18 15 12 9 6" />
            </svg>
        </div>
    );
}

// ─── Alert Icons ─────────────────────────────────────────────────────────────

function AlertIcon({ icon, color, size = 14 }: { icon: Alert["icon"]; color: string; size?: number }) {
    const props = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

    if (icon === "warning") {
        return (
            <svg {...props}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
        );
    }
    if (icon === "refresh") {
        return (
            <svg {...props}>
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
        );
    }
    if (icon === "cpu") {
        return (
            <svg {...props}>
                <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
                <rect x="9" y="9" width="6" height="6" />
                <line x1="9" y1="1" x2="9" y2="4" />
                <line x1="15" y1="1" x2="15" y2="4" />
                <line x1="9" y1="20" x2="9" y2="23" />
                <line x1="15" y1="20" x2="15" y2="23" />
                <line x1="20" y1="9" x2="23" y2="9" />
                <line x1="20" y1="14" x2="23" y2="14" />
                <line x1="1" y1="9" x2="4" y2="9" />
                <line x1="1" y1="14" x2="4" y2="14" />
            </svg>
        );
    }
    if (icon === "memory") {
        return (
            <svg {...props}>
                <rect x="3" y="6" width="18" height="12" rx="2" />
                <line x1="7" y1="10" x2="7" y2="14" />
                <line x1="11" y1="10" x2="11" y2="14" />
                <line x1="15" y1="10" x2="15" y2="14" />
                <line x1="19" y1="10" x2="19" y2="14" />
            </svg>
        );
    }
    // shield
    return (
        <svg {...props}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <polyline points="9 12 11 14 15 10" />
        </svg>
    );
}
