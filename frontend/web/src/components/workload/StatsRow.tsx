"use client";

import { useEffect, useState } from "react";
import { getClusterSummary, getPods, type ClusterSummary, type PodInfo } from "@/lib/api";

// ─── Stat Cards Row (5 cards) ────────────────────────────────────────────────

export function StatsRow() {
    const [summary, setSummary] = useState<ClusterSummary | null>(null);
    const [pods, setPods] = useState<PodInfo[]>([]);

    useEffect(() => {
        async function load() {
            try {
                const [s, p] = await Promise.all([
                    getClusterSummary().catch(() => null),
                    getPods().catch(() => []),
                ]);
                setSummary(s);
                setPods(p || []);
            } catch { }
        }
        load();
        const interval = setInterval(load, 15000);
        return () => clearInterval(interval);
    }, []);

    const runningPods = summary?.running_pods ?? 0;
    const totalPods = summary?.total_pods ?? 0;
    const pendingPods = pods.filter(p => p.status === "Pending").length;
    const restartingPods = pods.filter(p => p.restarts > 3).length;
    const failedPods = summary?.failed_pods ?? 0;
    const healthScore = totalPods > 0 ? Math.round((runningPods / totalPods) * 100) : 0;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <StatCard
                color="#3fb950"
                glowColor="rgba(63, 185, 80, 0.18)"
                label="Running Pods"
                showPlus
                value={runningPods.toLocaleString()}
                trend={`${totalPods} total pods in cluster`}
                hexIcon={<CubeIcon color="#3fb950" />}
                sparkline={
                    <Sparkline
                        points="0,18 12,16 24,17 36,12 48,13 60,8 72,9 84,5 96,6 108,3 120,4 132,2 144,3 156,2 168,1 180,3"
                        color="#3fb950"
                    />
                }
            />

            <StatCard
                color="#f0883e"
                glowColor="rgba(240, 136, 62, 0.18)"
                label="Pending Pods"
                value={String(pendingPods)}
                trend={pendingPods > 0 ? `${pendingPods} awaiting scheduling` : "All pods scheduled"}
                hexIcon={<ClockIcon color="#f0883e" />}
                sparkline={
                    <Sparkline
                        points="0,16 12,15 24,13 36,14 48,11 60,10 72,8 84,9 96,7 108,5 120,6 132,4 144,5 156,3 168,4 180,2"
                        color="#f0883e"
                    />
                }
            />

            <StatCard
                color="#f85149"
                glowColor="rgba(248, 81, 73, 0.20)"
                label="Restarting Pods"
                value={String(restartingPods)}
                trend={restartingPods > 0 ? `${restartingPods} pods with >3 restarts` : "No excessive restarts"}
                hexIcon={<RefreshIcon color="#f85149" />}
                sparkline={
                    <Sparkline
                        points="0,14 10,8 20,16 30,4 40,17 50,3 60,15 70,5 80,18 90,2 100,16 110,4 120,17 130,5 140,15 150,3 160,18 170,2 180,9"
                        color="#f85149"
                    />
                }
            />

            <StatCard
                color="#a371f7"
                glowColor="rgba(163, 113, 247, 0.18)"
                label="Failed Pods"
                value={String(failedPods)}
                trend={failedPods > 0 ? `${failedPods} pods in failed state` : "No failed pods"}
                hexIcon={<XIcon color="#a371f7" />}
                sparkline={<BarSparkline color="#a371f7" />}
            />

            <HealthScoreCard score={healthScore} />
        </div>
    );
}

// ─── Individual Stat Card ────────────────────────────────────────────────────

interface StatCardProps {
    color: string;
    glowColor: string;
    label: string;
    showPlus?: boolean;
    value: string;
    trend: string;
    hexIcon: React.ReactNode;
    sparkline: React.ReactNode;
}

function StatCard({ color, glowColor, label, showPlus, value, trend, hexIcon, sparkline }: StatCardProps) {
    return (
        <div
            className="relative rounded-[10px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] overflow-hidden hover:border-[rgba(15,23,42,0.14)] transition-colors"
            style={{
                background: `radial-gradient(circle at 85% 30%, ${glowColor} 0%, transparent 55%), rgba(255,255,255,0.02)`,
            }}
        >
            <div className="px-4 pt-3.5 pb-0 flex items-start justify-between gap-3">
                <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-2">
                        <span
                            className="w-1.5 h-1.5 rounded-full shrink-0 wi-live-dot"
                            style={{ background: color, boxShadow: `0 0 6px ${color}` }}
                        />
                        <span className="text-[12px] font-semibold" style={{ color }}>{label}</span>
                        {showPlus && (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                        )}
                    </div>
                    <p className="text-[32px] font-bold text-[#f7f8f8] leading-none tracking-tight">
                        {value}
                    </p>
                    <p
                        className="text-[11px] mt-1.5 font-medium"
                        style={{ color }}
                    >
                        {trend}
                    </p>
                </div>
                <div className="shrink-0">
                    <Hexagon color={color}>{hexIcon}</Hexagon>
                </div>
            </div>
            {/* Full-width vibrant sparkline at bottom */}
            <div className="mt-1.5 px-1 pb-1 relative h-[36px]">
                <div className="absolute inset-x-0 bottom-0 h-full">{sparkline}</div>
            </div>
        </div>
    );
}

// ─── Health Score Card (5th, with donut) ─────────────────────────────────────

function HealthScoreCard({ score }: { score: number }) {
    const r = 30;
    const circumference = 2 * Math.PI * r;
    const offset = circumference - (score / 100) * circumference;

    return (
        <div
            className="relative rounded-[10px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] overflow-hidden hover:border-[rgba(15,23,42,0.14)] transition-colors"
            style={{
                background: `radial-gradient(circle at 85% 50%, rgba(63, 185, 80, 0.15) 0%, rgba(88, 166, 255, 0.10) 30%, transparent 60%), rgba(255,255,255,0.02)`,
            }}
        >
            <div className="px-4 py-3.5 flex items-center justify-between gap-3 h-full">
                <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 mb-2">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7170ff" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
                        </svg>
                        <span className="text-[12px] font-semibold text-[#7170ff]">Overall Health Score</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-[32px] font-bold text-[#f7f8f8] leading-none tracking-tight">{score}</span>
                        <span className="text-[16px] text-[#94a3b8] font-medium">/100</span>
                    </div>
                    <div className="mt-2">
                        <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold"
                            style={{ background: score >= 80 ? "rgba(63,185,80,0.15)" : score >= 50 ? "rgba(240,136,62,0.15)" : "rgba(248,81,73,0.15)", color: score >= 80 ? "#3fb950" : score >= 50 ? "#f0883e" : "#f85149" }}
                        >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: score >= 80 ? "#3fb950" : score >= 50 ? "#f0883e" : "#f85149", boxShadow: `0 0 4px ${score >= 80 ? "#3fb950" : score >= 50 ? "#f0883e" : "#f85149"}` }} />
                            {score >= 80 ? "Excellent" : score >= 50 ? "Degraded" : "Critical"}
                        </span>
                    </div>
                </div>
                <div className="shrink-0 relative">
                    <svg width="78" height="78" viewBox="0 0 78 78">
                        <defs>
                            <linearGradient id="health-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#3fb950" />
                                <stop offset="100%" stopColor="#7170ff" />
                            </linearGradient>
                            <filter id="health-glow" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="2" result="blur" />
                                <feMerge>
                                    <feMergeNode in="blur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>
                        <circle cx="39" cy="39" r={r} fill="none" stroke="rgba(15,23,42,0.10)" strokeWidth="6" />
                        <circle
                            cx="39"
                            cy="39"
                            r={r}
                            fill="none"
                            stroke="url(#health-grad)"
                            strokeWidth="6"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={offset}
                            transform="rotate(-90 39 39)"
                            filter="url(#health-glow)"
                        />
                        {/* Sparkle dots around the ring */}
                        <circle cx="39" cy="6" r="1.2" fill="#3fb950" className="wi-sparkle" style={{ animationDelay: "0s" }} />
                        <circle cx="72" cy="39" r="1.2" fill="#7170ff" className="wi-sparkle" style={{ animationDelay: "0.6s" }} />
                        <circle cx="39" cy="72" r="1.2" fill="#a371f7" className="wi-sparkle" style={{ animationDelay: "1.2s" }} />
                        <circle cx="6" cy="39" r="1" fill="#3fb950" className="wi-sparkle" style={{ animationDelay: "1.8s" }} />
                        <circle cx="65" cy="13" r="0.8" fill="#a371f7" className="wi-sparkle" style={{ animationDelay: "0.4s" }} />
                        <circle cx="13" cy="65" r="0.8" fill="#7170ff" className="wi-sparkle" style={{ animationDelay: "1.5s" }} />
                    </svg>
                </div>
            </div>
        </div>
    );
}

// ─── Hexagon Wrapper (with glow) ─────────────────────────────────────────────

function Hexagon({ color, children }: { color: string; children: React.ReactNode }) {
    const id = color.replace("#", "");
    return (
        <div className="relative w-[52px] h-[52px] flex items-center justify-center">
            <svg width="52" height="52" viewBox="0 0 52 52" className="absolute inset-0">
                <defs>
                    <linearGradient id={`hex-grad-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={color} stopOpacity="0.35" />
                        <stop offset="100%" stopColor={color} stopOpacity="0.08" />
                    </linearGradient>
                    <filter id={`hex-glow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feFlood floodColor={color} floodOpacity="0.6" />
                        <feComposite in2="blur" operator="in" />
                        <feMerge>
                            <feMergeNode />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
                {/* Outer faint glow hex */}
                <polygon
                    points="26,2 48,13 48,39 26,50 4,39 4,13"
                    fill={`url(#hex-grad-${id})`}
                    stroke={color}
                    strokeWidth="1.5"
                    strokeOpacity="0.85"
                    filter={`url(#hex-glow-${id})`}
                />
                {/* Inner stroke only hex for definition */}
                <polygon
                    points="26,5 45,15 45,37 26,47 7,37 7,15"
                    fill="none"
                    stroke={color}
                    strokeWidth="0.5"
                    strokeOpacity="0.4"
                />
            </svg>
            <div className="relative z-10">{children}</div>
        </div>
    );
}

// ─── Sparklines (Full Width Vivid) ───────────────────────────────────────────

function Sparkline({ points, color }: { points: string; color: string }) {
    const id = color.replace("#", "");
    return (
        <svg width="100%" height="36" viewBox="0 0 180 24" preserveAspectRatio="none" className="overflow-visible">
            <defs>
                <linearGradient id={`spark-fill-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={color} stopOpacity="0.45" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
                <filter id={`spark-glow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="1.5" />
                </filter>
            </defs>
            {/* Filled area underneath */}
            <polygon
                points={`${points} 180,24 0,24`}
                fill={`url(#spark-fill-${id})`}
            />
            {/* Glow layer */}
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.7"
                filter={`url(#spark-glow-${id})`}
            />
            {/* Crisp top line */}
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function BarSparkline({ color }: { color: string }) {
    const heights = [3, 7, 4, 9, 5, 11, 6, 14, 8, 16, 10, 18, 12, 15, 8, 13, 6, 11, 4, 9];
    const id = color.replace("#", "");
    return (
        <svg width="100%" height="36" viewBox="0 0 180 24" preserveAspectRatio="none">
            <defs>
                <linearGradient id={`bar-grad-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={color} stopOpacity="1" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.4" />
                </linearGradient>
            </defs>
            {heights.map((h, i) => (
                <rect
                    key={i}
                    x={i * 9 + 1}
                    y={24 - h}
                    width="6"
                    height={h}
                    rx="1"
                    fill={`url(#bar-grad-${id})`}
                    opacity={0.7 + (h / 18) * 0.3}
                />
            ))}
        </svg>
    );
}

// ─── Hexagon Inner Icons ─────────────────────────────────────────────────────

function CubeIcon({ color }: { color: string }) {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 3px ${color})` }}>
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
    );
}

function ClockIcon({ color }: { color: string }) {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 3px ${color})` }}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    );
}

function RefreshIcon({ color }: { color: string }) {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 3px ${color})` }}>
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
    );
}

function XIcon({ color }: { color: string }) {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 3px ${color})` }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
    );
}
