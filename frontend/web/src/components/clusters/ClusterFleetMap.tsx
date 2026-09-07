"use client";

import { useEffect, useState } from "react";
import { getFleetClusters, type ClusterRegistration } from "@/lib/api";

// ─── Cluster Fleet Map (glass cards + orbital connections) ───────────────────

interface ClusterCard {
    id: string;
    name: string;
    env: string;
    healthScore: number;
    status: "healthy" | "warning" | "critical";
    workloads: number;
    cpu: number;
    memory: number;
    // Position (% based for responsive)
    top: string;
    left: string;
}

// Positions for clusters (cycle through predefined positions)
const POSITIONS = [
    { top: "5%", left: "32%" },
    { top: "28%", left: "2%" },
    { top: "28%", left: "65%" },
    { top: "62%", left: "28%" },
    { top: "55%", left: "60%" },
    { top: "10%", left: "5%" },
    { top: "68%", left: "5%" },
    { top: "10%", left: "70%" },
];

function mapApiToCard(c: ClusterRegistration, idx: number): ClusterCard {
    const pos = POSITIONS[idx % POSITIONS.length];
    let status: "healthy" | "warning" | "critical" = "healthy";
    if (c.health_score < 50) status = "critical";
    else if (c.health_score < 80) status = "warning";

    return {
        id: c.id,
        name: c.name,
        env: c.region || c.environment,
        healthScore: c.health_score,
        status,
        workloads: c.workloads,
        cpu: c.cpu_percent,
        memory: c.memory_percent,
        top: pos.top,
        left: pos.left,
    };
}

const FALLBACK_CLUSTERS: ClusterCard[] = [
    { id: "local", name: "Local Cluster", env: "Local", healthScore: 95, status: "healthy", workloads: 12, cpu: 45, memory: 60, top: "28%", left: "32%" },
];

const STATUS_ICON: Record<string, { bg: string; border: string; icon: string }> = {
    healthy: { bg: "rgba(63,185,80,0.15)", border: "#3fb950", icon: "check" },
    warning: { bg: "rgba(240,136,62,0.15)", border: "#f0883e", icon: "warning" },
    critical: { bg: "rgba(248,81,73,0.15)", border: "#f85149", icon: "x" },
};

export function ClusterFleetMap() {
    const [hovered, setHovered] = useState<string | null>(null);
    const [clusters, setClusters] = useState<ClusterCard[]>([]);

    useEffect(() => {
        async function load() {
            try {
                const data = await getFleetClusters();
                if (data.clusters && data.clusters.length > 0) {
                    setClusters(data.clusters.map((c, i) => mapApiToCard(c, i)));
                }
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
                <div className="flex items-center gap-2.5">
                    <h3 className="text-[14px] font-semibold text-[#f7f8f8]">Cluster Fleet Map</h3>
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#3fb950]/10 border border-[#3fb950]/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950]" style={{ boxShadow: "0 0 6px #3fb950", animation: "wi-pulse 2s infinite" }} />
                        <span className="text-[10px] text-[#3fb950] font-semibold">Live</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#64748b]">View:</span>
                    <span className="text-[11px] text-[#f7f8f8] font-medium">Intelligence ▾</span>
                    <div className="flex items-center gap-1 ml-2">
                        {["list", "filter", "expand"].map((icon, i) => (
                            <button key={i} className="w-6 h-6 rounded flex items-center justify-center text-[#64748b] hover:text-[#f7f8f8] hover:bg-[rgba(15,23,42,0.10)] transition-colors">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    {icon === "list" && <><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></>}
                                    {icon === "filter" && <><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></>}
                                    {icon === "expand" && <><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></>}
                                </svg>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Subtitle */}
            <div className="px-4 py-1.5 border-b border-[rgba(15,23,42,0.10)]">
                <p className="text-[11px] text-[#64748b]">Real-time cluster relationships and operational health</p>
            </div>

            {/* Canvas */}
            <div
                className="relative w-full flex-1"
                style={{
                    minHeight: "480px",
                    background: `
                        radial-gradient(ellipse 80% 60% at 50% 50%, rgba(30, 60, 120, 0.15) 0%, transparent 70%),
                        radial-gradient(ellipse 50% 40% at 20% 30%, rgba(59, 130, 246, 0.08) 0%, transparent 55%),
                        radial-gradient(ellipse 50% 40% at 80% 70%, rgba(34, 211, 238, 0.06) 0%, transparent 55%),
                        linear-gradient(180deg, #0f1011 0%, #191a1b 50%, #0f1011 100%)
                    `,
                }}
            >
                {/* World map dots (subtle background pattern) */}
                <WorldMapDots />

                {/* Orbital connection lines (SVG behind cards) */}
                <svg className="absolute inset-0 w-full h-full z-[1] pointer-events-none" preserveAspectRatio="none">
                    <defs>
                        <filter id="orbital-glow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="2" result="b" />
                            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                        </filter>
                    </defs>
                    {/* Elliptical orbital paths */}
                    <ellipse cx="50%" cy="50%" rx="38%" ry="32%" fill="none" stroke="#22d3ee" strokeWidth="1" strokeOpacity="0.2" strokeDasharray="4 6" />
                    <ellipse cx="50%" cy="50%" rx="28%" ry="22%" fill="none" stroke="#3fb950" strokeWidth="0.8" strokeOpacity="0.15" strokeDasharray="3 5" />

                    {/* Animated dots on orbital paths */}
                    <circle r="3" fill="#22d3ee" opacity="0.9" filter="url(#orbital-glow)">
                        <animateMotion dur="8s" repeatCount="indefinite" path="M 50,50 m -38,0 a 38,32 0 1,0 76,0 a 38,32 0 1,0 -76,0" />
                    </circle>
                    <circle r="2.5" fill="#3fb950" opacity="0.8" filter="url(#orbital-glow)">
                        <animateMotion dur="6s" repeatCount="indefinite" path="M 50,50 m -28,0 a 28,22 0 1,1 56,0 a 28,22 0 1,1 -56,0" />
                    </circle>
                    <circle r="2" fill="#f0883e" opacity="0.7">
                        <animateMotion dur="10s" repeatCount="indefinite" path="M 50,50 m -38,0 a 38,32 0 1,0 76,0 a 38,32 0 1,0 -76,0" begin="4s" />
                    </circle>

                    {/* Glowing connection dots scattered */}
                    {Array.from({ length: 20 }, (_, i) => {
                        const seed1 = (i * 7919 + 104729) % 100;
                        const seed2 = (i * 3571 + 88379) % 100;
                        return (
                            <circle key={i} cx={`${10 + seed1 * 0.8}%`} cy={`${10 + seed2 * 0.8}%`} r="1.5" fill="#22d3ee" opacity="0.4" style={{ animation: `wi-pulse ${2 + (i % 4)}s infinite`, animationDelay: `${i * 0.3}s` }} />
                        );
                    })}
                </svg>

                {/* Cluster cards (positioned absolutely) */}
                {clusters.map(cluster => (
                    <div
                        key={cluster.id}
                        className="absolute z-10"
                        style={{ top: cluster.top, left: cluster.left }}
                        onMouseEnter={() => setHovered(cluster.id)}
                        onMouseLeave={() => setHovered(null)}
                    >
                        <ClusterCardComponent cluster={cluster} highlighted={hovered === cluster.id} />
                    </div>
                ))}

                {/* Health Status legend */}
                <div className="absolute bottom-4 left-4 z-20 space-y-3">
                    <div>
                        <p className="text-[10px] text-[#f7f8f8] font-semibold mb-1.5">Health Status</p>
                        <div className="space-y-1">
                            {[{ c: "#3fb950", l: "Healthy" }, { c: "#f0883e", l: "Warning" }, { c: "#f85149", l: "Critical" }, { c: "#94a3b8", l: "Unknown" }].map(i => (
                                <div key={i.l} className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full" style={{ background: i.c }} />
                                    <span className="text-[10px] text-[#64748b]">{i.l}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#64748b]">Traffic Flow</span>
                        <div className="w-16 h-1.5 rounded-full" style={{ background: "linear-gradient(90deg, #22d3ee, #f85149)" }} />
                        <span className="text-[9px] text-[#94a3b8]">Low</span>
                        <span className="text-[9px] text-[#94a3b8]">High</span>
                    </div>
                </div>

                {/* Bottom-right controls */}
                <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 px-1.5 py-1 rounded-md bg-[rgba(255,255,255,0.02)]/85 border border-[rgba(15,23,42,0.14)] backdrop-blur-sm">
                    <CtrlBtn>+</CtrlBtn>
                    <CtrlBtn>−</CtrlBtn>
                    <CtrlBtn>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4" />
                        </svg>
                    </CtrlBtn>
                </div>
            </div>
        </div>
    );
}

// ─── Cluster Card Component ──────────────────────────────────────────────────

function ClusterCardComponent({ cluster, highlighted }: { cluster: ClusterCard; highlighted: boolean }) {
    const statusStyle = STATUS_ICON[cluster.status];
    const borderColor = cluster.status === "healthy" ? "#3fb950" : cluster.status === "warning" ? "#f0883e" : "#f85149";

    return (
        <div
            className={`rounded-xl backdrop-blur-md border p-3 w-[200px] transition-all duration-200 ${highlighted ? "scale-105 shadow-[0_0_20px_rgba(34,211,238,0.2)]" : ""}`}
            style={{
                background: "rgba(13, 17, 23, 0.85)",
                borderColor: highlighted ? borderColor : "rgba(15,23,42,0.10)",
                boxShadow: highlighted ? `0 0 16px ${borderColor}30` : "0 4px 16px rgba(0,0,0,0.4)",
            }}
        >
            {/* Status badges (top corners) */}
            <div className="flex items-center justify-between mb-2">
                <StatusBadge status={cluster.status} />
                <div className="flex items-center gap-1">
                    <StatusBadge status={cluster.status} small />
                </div>
            </div>

            {/* Name + env */}
            <p className="text-[13px] font-bold text-[#f7f8f8] text-center">{cluster.name}</p>
            <p className="text-[11px] font-semibold text-center mb-2" style={{ color: borderColor }}>{cluster.env}</p>

            {/* Health Score */}
            <div className="text-center mb-2">
                <span className="text-[28px] font-bold text-[#f7f8f8] font-mono leading-none">{cluster.healthScore}</span>
                <span className="text-[10px] text-[#64748b] ml-1">Health Score</span>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-1 text-center">
                <div>
                    <p className="text-[12px] font-bold text-[#f7f8f8] font-mono">{cluster.workloads}</p>
                    <p className="text-[9px] text-[#94a3b8]">Workloads</p>
                </div>
                <div>
                    <p className="text-[12px] font-bold text-[#f7f8f8] font-mono">{cluster.cpu}%</p>
                    <p className="text-[9px] text-[#94a3b8]">CPU</p>
                </div>
                <div>
                    <p className="text-[12px] font-bold text-[#f7f8f8] font-mono">{cluster.memory}%</p>
                    <p className="text-[9px] text-[#94a3b8]">Memory</p>
                </div>
            </div>

            {/* Mini sparkline at bottom */}
            <div className="mt-2 h-[20px]">
                <svg width="100%" height="20" viewBox="0 0 180 20" preserveAspectRatio="none">
                    <polyline
                        points="0,14 12,12 24,15 36,10 48,13 60,8 72,11 84,6 96,9 108,4 120,7 132,3 144,6 156,2 168,5 180,3"
                        fill="none"
                        stroke={borderColor}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        opacity="0.7"
                    />
                </svg>
            </div>
        </div>
    );
}

function StatusBadge({ status, small }: { status: string; small?: boolean }) {
    const s = STATUS_ICON[status];
    const size = small ? 18 : 22;
    return (
        <div
            className="rounded-full flex items-center justify-center"
            style={{ width: size, height: size, background: s.bg, border: `1.5px solid ${s.border}` }}
        >
            {s.icon === "check" && (
                <svg width={size - 8} height={size - 8} viewBox="0 0 24 24" fill="none" stroke={s.border} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                </svg>
            )}
            {s.icon === "warning" && (
                <svg width={size - 8} height={size - 8} viewBox="0 0 24 24" fill="none" stroke={s.border} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
            )}
            {s.icon === "x" && (
                <svg width={size - 8} height={size - 8} viewBox="0 0 24 24" fill="none" stroke={s.border} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
            )}
        </div>
    );
}

function CtrlBtn({ children }: { children: React.ReactNode }) {
    return <button className="w-6 h-6 rounded flex items-center justify-center text-[#64748b] hover:text-[#f7f8f8] hover:bg-[rgba(15,23,42,0.10)] transition-colors text-[12px] font-light">{children}</button>;
}

// ─── World Map Dots (subtle background) ──────────────────────────────────────

function WorldMapDots() {
    // Deterministic scattered dots simulating a world map outline
    const dots = Array.from({ length: 150 }, (_, i) => {
        const s1 = (i * 9301 + 49297) % 233280 / 233280;
        const s2 = (i * 1103 + 12345) % 65536 / 65536;
        const s3 = (i * 8121 + 28411) % 134456 / 134456;
        return { x: s1 * 100, y: s2 * 100, size: s3 * 1.5 + 0.5, opacity: s3 * 0.3 + 0.1 };
    });

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {dots.map((d, i) => (
                <div
                    key={i}
                    className="absolute rounded-full"
                    style={{
                        left: `${d.x}%`,
                        top: `${d.y}%`,
                        width: `${d.size}px`,
                        height: `${d.size}px`,
                        backgroundColor: i % 8 === 0 ? "#22d3ee" : i % 5 === 0 ? "#3fb950" : "#1e3a5f",
                        opacity: d.opacity,
                    }}
                />
            ))}
        </div>
    );
}
