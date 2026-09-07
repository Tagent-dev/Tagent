"use client";

import { useEffect, useState } from "react";
import { getRiskSummary, getRiskPredictions, type RiskSummaryResponse, type RiskPrediction } from "@/lib/api";

function generateSparkFromSeed(seed: number): string {
    const points: string[] = [];
    let y = 12;
    for (let x = 0; x <= 96; x += 8) {
        y = Math.max(2, Math.min(18, y + ((seed * (x + 1) * 31 + 7) % 7) - 3));
        points.push(`${x},${y}`);
    }
    return points.join(" ");
}

// ─── AI Recommendations Sidebar ──────────────────────────────────────────────

interface Rec {
    icon: "scale" | "drain" | "resize" | "update";
    iconColor: string;
    iconBg: string;
    title: string;
    badge: string;
    badgeColor: string;
    badgeBg: string;
    description: string;
    impactLabel: string;
    impactValue: string;
    impactColor: string;
    confidence: number;
    sparkPoints: string;
    sparkColor: string;
}

const RECS: Rec[] = [
    {
        icon: "scale",
        iconColor: "#3fb950", iconBg: "rgba(63,185,80,0.15)",
        title: "Scale Node Group",
        badge: "Proactive", badgeColor: "#3fb950", badgeBg: "rgba(63,185,80,0.15)",
        description: "Worker group in us-east-1 showing increasing CPU pressure.",
        impactLabel: "Impact", impactValue: "+28% stability", impactColor: "#3fb950",
        confidence: 94,
        sparkColor: "#3fb950",
        sparkPoints: "0,18 8,16 16,17 24,12 32,13 40,8 48,9 56,5 64,6 72,3 80,4 88,2 96,3",
    },
    {
        icon: "drain",
        iconColor: "#f0883e", iconBg: "rgba(240,136,62,0.15)",
        title: "Drain Node",
        badge: "Recommended", badgeColor: "#f0883e", badgeBg: "rgba(240,136,62,0.15)",
        description: "ip-10-0-2-15 showing disk errors and high IO wait.",
        impactLabel: "Impact", impactValue: "Prevent failure", impactColor: "#f0883e",
        confidence: 91,
        sparkColor: "#f0883e",
        sparkPoints: "0,15 8,16 16,13 24,14 32,11 40,12 48,9 56,10 64,7 72,8 80,5 88,6 96,4",
    },
    {
        icon: "resize",
        iconColor: "#a371f7", iconBg: "rgba(163,113,247,0.15)",
        title: "Right-size Instance",
        badge: "Optimization", badgeColor: "#a371f7", badgeBg: "rgba(163,113,247,0.15)",
        description: "Node group in eu-central-1 over-provisioned.",
        impactLabel: "Impact", impactValue: "Save $1,240/mo", impactColor: "#3fb950",
        confidence: 89,
        sparkColor: "#22d3ee",
        sparkPoints: "0,14 8,12 16,15 24,10 32,13 40,8 48,11 56,6 64,9 72,4 80,7 88,3 96,5",
    },
    {
        icon: "update",
        iconColor: "#a371f7", iconBg: "rgba(163,113,247,0.15)",
        title: "Update Available",
        badge: "Security", badgeColor: "#f0883e", badgeBg: "rgba(240,136,62,0.15)",
        description: "3 nodes have security updates available.",
        impactLabel: "Impact", impactValue: "Reduce risk", impactColor: "#f85149",
        confidence: 96,
        sparkColor: "#a371f7",
        sparkPoints: "0,16 8,14 16,11 24,15 32,9 40,12 48,7 56,10 64,5 72,8 80,3 88,6 96,2",
    },
];

export function AIRecommendationsPanel() {
    const [recs, setRecs] = useState<Rec[]>([]);

    useEffect(() => {
        async function load() {
            try {
                const [riskData, predictions] = await Promise.all([
                    getRiskSummary().catch(() => null),
                    getRiskPredictions().catch(() => ({ predictions: [], total: 0 })),
                ]);
                const derived: Rec[] = [];
                const preds = predictions.predictions || [];

                for (const pred of preds.slice(0, 4)) {
                    const prob = pred.probability;
                    const color = prob > 0.7 ? "#f85149" : prob > 0.4 ? "#f0883e" : "#3fb950";
                    derived.push({
                        icon: prob > 0.7 ? "scale" : prob > 0.4 ? "drain" : "resize",
                        iconColor: color,
                        iconBg: `${color}26`,
                        title: pred.preventive_action.length > 25 ? pred.preventive_action.slice(0, 23) + "…" : pred.preventive_action,
                        badge: prob > 0.7 ? "Critical" : prob > 0.4 ? "Recommended" : "Proactive",
                        badgeColor: color,
                        badgeBg: `${color}26`,
                        description: `${pred.service}: ${pred.predicted_issue}`,
                        impactLabel: "Impact",
                        impactValue: pred.time_horizon,
                        impactColor: color,
                        confidence: Math.round(pred.probability * 100),
                        sparkColor: color,
                        sparkPoints: generateSparkFromSeed(derived.length),
                    });
                }
                setRecs(derived);
            } catch { }
        }
        load();
        const interval = setInterval(load, 15000);
        return () => clearInterval(interval);
    }, []);
    return (
        <div className="rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(15,23,42,0.10)]">
                <div className="flex items-center gap-2">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="#a371f7"><path d="M12 0L14 9L24 12L14 15L12 24L10 15L0 12L10 9Z" /></svg>
                    <h3 className="text-[14px] font-semibold text-[#f7f8f8]">AI Recommendations</h3>
                </div>
                <button className="text-[11px] text-[#7170ff] hover:text-[#79c0ff] font-medium">View all</button>
            </div>

            {/* Recommendations */}
            <div className="px-3 py-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {recs.map((rec, i) => (
                        <RecCard key={i} rec={rec} />
                    ))}
                </div>

                {/* Anomaly + Saturation gauges (4 in a row) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                    <GaugeCard label="Anomaly" value={4} unit="%" status="Low" statusColor="#3fb950" sparkColor="#3fb950" sparkPoints="0,8 12,7 24,9 36,6 48,8 60,5 72,7 84,4 96,6" />
                    <GaugeCard label="Saturation (1h)" value={67} unit="%" status="High" statusColor="#f85149" subStatus="At Risk" subStatusColor="#f0883e" sparkColor="#f0883e" sparkPoints="0,12 12,10 24,11 36,8 48,9 60,6 72,7 84,4 96,5" />
                    <GaugeCard label="Anomaly" value={4} unit="%" status="Low" statusColor="#3fb950" sparkColor="#3fb950" sparkPoints="0,8 12,7 24,9 36,6 48,8 60,5 72,7 84,4 96,6" hideMenu />
                    <GaugeCard label="Saturation (1h)" value={18} unit="%" status="Safe" statusColor="#3fb950" subStatus="Safe" subStatusColor="#3fb950" sparkColor="#3fb950" sparkPoints="0,8 12,9 24,7 36,8 48,6 60,7 72,5 84,6 96,4" hideMenu />
                </div>
            </div>
        </div>
    );
}

// ─── Single Recommendation Card ──────────────────────────────────────────────

function RecCard({ rec }: { rec: Rec }) {
    return (
        <div className="rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] hover:border-[rgba(15,23,42,0.14)] transition-colors p-3">
            <div className="flex items-start gap-2.5 mb-2">
                <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: rec.iconBg }}>
                    <RecIcon icon={rec.icon} color={rec.iconColor} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className="text-[12px] font-semibold text-[#f7f8f8]">{rec.title}</p>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-semibold shrink-0" style={{ background: rec.badgeBg, color: rec.badgeColor, border: `1px solid ${rec.badgeColor}40` }}>
                            {rec.badge}
                        </span>
                    </div>
                    <p className="text-[11px] text-[#64748b] leading-snug">{rec.description}</p>
                </div>
            </div>
            <div className="flex items-center justify-between gap-2 text-[10px] mb-2">
                <span className="text-[#64748b]">
                    {rec.impactLabel} <span className="font-semibold ml-0.5" style={{ color: rec.impactColor }}>{rec.impactValue}</span>
                </span>
                <span className="text-[#64748b]">
                    Confidence <span className="font-semibold text-[#f7f8f8] ml-0.5">{rec.confidence}%</span>
                </span>
            </div>
            <Sparkline points={rec.sparkPoints} color={rec.sparkColor} />
        </div>
    );
}

// ─── Mini Gauge Card ─────────────────────────────────────────────────────────

function GaugeCard({ label, value, unit, status, statusColor, subStatus, subStatusColor, sparkColor, sparkPoints, hideMenu }: {
    label: string; value: number; unit: string; status: string; statusColor: string;
    subStatus?: string; subStatusColor?: string;
    sparkColor: string; sparkPoints: string; hideMenu?: boolean;
}) {
    return (
        <div className="rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] p-2.5 relative">
            <div className="flex items-center justify-between gap-1 mb-1">
                <p className="text-[10px] text-[#64748b] font-medium truncate">{label}</p>
                {!hideMenu && (
                    <button className="text-[#94a3b8] hover:text-[#f7f8f8]">
                        <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                            <circle cx="3" cy="8" r="1.2" /><circle cx="8" cy="8" r="1.2" /><circle cx="13" cy="8" r="1.2" />
                        </svg>
                    </button>
                )}
            </div>
            <p className="text-[18px] font-bold text-[#f7f8f8] leading-none">{value}<span className="text-[12px] text-[#94a3b8] font-medium">{unit}</span></p>
            <Sparkline points={sparkPoints} color={sparkColor} small />
            <div className="flex items-center justify-between mt-1.5">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold" style={{ background: `${statusColor}20`, color: statusColor }}>
                    {status}
                </span>
                {subStatus && (
                    <span className="text-[9px] font-semibold" style={{ color: subStatusColor }}>
                        {subStatus}
                    </span>
                )}
            </div>
        </div>
    );
}

// ─── Sparkline ───────────────────────────────────────────────────────────────

function Sparkline({ points, color, small }: { points: string; color: string; small?: boolean }) {
    const id = color.replace("#", "") + (small ? "-s" : "");
    return (
        <svg width="100%" height={small ? "16" : "24"} viewBox="0 0 96 20" preserveAspectRatio="none" className="block">
            <defs>
                <linearGradient id={`g-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={color} stopOpacity="0.4" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <polygon points={`${points} 96,20 0,20`} fill={`url(#g-${id})`} />
            <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" style={{ filter: "blur(1.5px)" }} />
            <polyline points={points} fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

// ─── Recommendation Icons ────────────────────────────────────────────────────

function RecIcon({ icon, color }: { icon: Rec["icon"]; color: string }) {
    const props = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
    if (icon === "scale") return (
        <svg {...props}>
            <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
    );
    if (icon === "drain") return (
        <svg {...props}>
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
            <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
        </svg>
    );
    if (icon === "resize") return (
        <svg {...props}>
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
    );
    // update / shield
    return (
        <svg {...props}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <polyline points="9 12 11 14 15 10" />
        </svg>
    );
}
