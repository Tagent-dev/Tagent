"use client";

import { useEffect, useState } from "react";
import { getServices, getDeployments, type ServiceInfo, type DeploymentInfo } from "@/lib/api";

// ─── Dependency Impact Map (pill-shaped glass cards + neon connections) ──────

interface DepNode {
    id: string;
    label: string;
    version: string;
    status: "healthy" | "warning" | "critical" | "unknown";
    top: string;
    left: string;
}

const STATUS_COLORS: Record<string, { border: string; bg: string; icon: string }> = {
    healthy: { border: "#3fb950", bg: "rgba(63,185,80,0.08)", icon: "#3fb950" },
    warning: { border: "#f0883e", bg: "rgba(240,136,62,0.08)", icon: "#f0883e" },
    critical: { border: "#f85149", bg: "rgba(248,81,73,0.08)", icon: "#f85149" },
    unknown: { border: "#94a3b8", bg: "rgba(110,118,129,0.08)", icon: "#94a3b8" },
};

function buildDepNodes(deployments: DeploymentInfo[], services: ServiceInfo[]): DepNode[] {
    const items = deployments.length > 0 ? deployments : services.map(s => ({ name: s.name, namespace: s.namespace, replicas: 1, ready: 1, available: 1, age: "" }));
    if (items.length === 0) return [];

    const positions = [
        { top: "10%", left: "20%" }, { top: "32%", left: "12%" }, { top: "58%", left: "8%" },
        { top: "58%", left: "48%" }, { top: "82%", left: "22%" }, { top: "10%", left: "55%" },
        { top: "32%", left: "60%" }, { top: "82%", left: "55%" },
    ];

    return items.slice(0, 8).map((d, i) => ({
        id: d.name,
        label: d.name,
        version: d.age || "—",
        status: d.ready === d.replicas ? "healthy" : d.ready === 0 ? "critical" : "warning",
        top: positions[i % positions.length].top,
        left: positions[i % positions.length].left,
    }));
}

export function DependencyImpactMap() {
    const [nodes, setNodes] = useState<DepNode[]>([]);

    useEffect(() => {
        async function load() {
            try {
                const [deployments, services] = await Promise.all([
                    getDeployments().catch(() => []),
                    getServices().catch(() => []),
                ]);
                const built = buildDepNodes(deployments || [], services || []);
                setNodes(built);
            } catch { }
        }
        load();
        const interval = setInterval(load, 15000);
        return () => clearInterval(interval);
    }, []);
    return (
        <div className="rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[rgba(15,23,42,0.10)]">
                <h3 className="text-[14px] font-semibold text-[#f7f8f8]">Dependency Impact Map</h3>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#3fb950]/10 border border-[#3fb950]/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950]" style={{ boxShadow: "0 0 6px #3fb950", animation: "wi-pulse 2s infinite" }} />
                    <span className="text-[10px] text-[#3fb950] font-semibold">Live</span>
                </div>
            </div>

            {/* Canvas */}
            <div
                className="relative flex-1"
                style={{
                    minHeight: "380px",
                    background: `
                        radial-gradient(ellipse 70% 60% at 50% 50%, rgba(30, 60, 120, 0.12) 0%, transparent 70%),
                        linear-gradient(180deg, #0f1011 0%, #191a1b 50%, #0f1011 100%)
                    `,
                }}
            >
                {/* Background orbital curves (decorative) */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-[1]" preserveAspectRatio="none">
                    <defs>
                        <filter id="dim-glow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="2" result="b" />
                            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                        </filter>
                    </defs>
                    {/* Decorative ellipses */}
                    <ellipse cx="50%" cy="50%" rx="35%" ry="40%" fill="none" stroke="#22d3ee" strokeWidth="0.8" strokeOpacity="0.12" strokeDasharray="4 6" />
                    <ellipse cx="45%" cy="55%" rx="25%" ry="30%" fill="none" stroke="#3fb950" strokeWidth="0.6" strokeOpacity="0.1" strokeDasharray="3 5" />

                    {/* Connection lines between nodes (approximate positions) */}
                    {[
                        { x1: "32%", y1: "18%", x2: "24%", y2: "40%" },
                        { x1: "32%", y1: "18%", x2: "60%", y2: "66%" },
                        { x1: "24%", y1: "40%", x2: "20%", y2: "66%" },
                        { x1: "24%", y1: "40%", x2: "60%", y2: "66%" },
                        { x1: "20%", y1: "66%", x2: "34%", y2: "90%" },
                        { x1: "60%", y1: "66%", x2: "34%", y2: "90%" },
                    ].map((line, i) => (
                        <line key={i} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke="#22d3ee" strokeWidth="1.5" strokeOpacity="0.4" filter="url(#dim-glow)" className="wi-flow-medium" />
                    ))}

                    {/* Animated dots on connections */}
                    {[0, 1, 2, 3, 4].map(i => (
                        <circle key={i} r="2.5" fill="#22d3ee" opacity="0.9" filter="url(#dim-glow)">
                            <animateMotion dur={`${2 + i * 0.5}s`} repeatCount="indefinite" path={`M ${20 + i * 8},${15 + i * 15} L ${30 + i * 5},${50 + i * 10}`} />
                        </circle>
                    ))}
                </svg>

                {/* Node cards (positioned absolutely) */}
                {nodes.map(node => (
                    <div
                        key={node.id}
                        className="absolute z-10"
                        style={{ top: node.top, left: node.left }}
                    >
                        <NodePill node={node} />
                    </div>
                ))}

                {/* Health legend (top-right) */}
                <div className="absolute top-4 right-4 z-20 space-y-1.5">
                    {[
                        { color: "#3fb950", label: "Healthy" },
                        { color: "#f0883e", label: "Warning" },
                        { color: "#f85149", label: "Critical" },
                        { color: "#94a3b8", label: "Unknown" },
                    ].map(l => (
                        <div key={l.label} className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ background: l.color, boxShadow: `0 0 4px ${l.color}` }} />
                            <span className="text-[11px] text-[#64748b]">{l.label}</span>
                        </div>
                    ))}
                </div>

                {/* Traffic Flow legend (bottom-right) */}
                <div className="absolute bottom-4 right-4 z-20">
                    <p className="text-[11px] text-[#f7f8f8] font-semibold mb-1.5">Traffic Flow</p>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#64748b]">Low</span>
                        <div className="w-20 h-1.5 rounded-full" style={{ background: "linear-gradient(90deg, #7170ff, #22d3ee, #f0883e, #f85149)" }} />
                        <span className="text-[10px] text-[#64748b]">High</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Pill-shaped Node Card ───────────────────────────────────────────────────

function NodePill({ node }: { node: DepNode }) {
    const style = STATUS_COLORS[node.status];

    return (
        <div
            className="flex items-center gap-2.5 px-3 py-2 rounded-full backdrop-blur-md border transition-all hover:scale-105"
            style={{
                background: style.bg,
                borderColor: style.border,
                boxShadow: `0 0 12px ${style.border}30, inset 0 1px 0 rgba(255,255,255,0.03)`,
            }}
        >
            {/* Hexagonal icon */}
            <div className="w-8 h-8 flex items-center justify-center shrink-0">
                <svg width="28" height="28" viewBox="0 0 32 32">
                    <polygon
                        points="16,2 28,9 28,23 16,30 4,23 4,9"
                        fill={`${style.border}20`}
                        stroke={style.border}
                        strokeWidth="1.5"
                        strokeOpacity="0.8"
                    />
                    {/* Inner cube icon */}
                    <g transform="translate(16, 16)" style={{ filter: `drop-shadow(0 0 3px ${style.icon})` }}>
                        <path d="M0,-6 L6,-3 L0,0 L-6,-3 Z" fill={style.icon} fillOpacity="0.5" stroke={style.icon} strokeWidth="0.6" strokeLinejoin="round" />
                        <path d="M-6,-3 L0,0 L0,6 L-6,3 Z" fill={style.icon} fillOpacity="0.2" stroke={style.icon} strokeWidth="0.6" strokeLinejoin="round" />
                        <path d="M6,-3 L0,0 L0,6 L6,3 Z" fill={style.icon} fillOpacity="0.35" stroke={style.icon} strokeWidth="0.6" strokeLinejoin="round" />
                    </g>
                </svg>
            </div>

            {/* Text */}
            <div>
                <p className="text-[12px] font-semibold text-[#f7f8f8] leading-tight">{node.label}</p>
                <p className="text-[10px] font-mono" style={{ color: style.border }}>{node.version}</p>
            </div>

            {/* Arrow indicator */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={style.border} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1 shrink-0 opacity-60">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
            </svg>
        </div>
    );
}
