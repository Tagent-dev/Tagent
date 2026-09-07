"use client";

import { useEffect, useState } from "react";
import { getClusterState, type NodeInfo } from "@/lib/api";

// ─── Isometric 3D Cluster Topology ───────────────────────────────────────────

interface Region {
    id: string;
    label: string;
    sublabel: string;
    cx: number;
    cy: number;
    color: string;
    nodes: Array<{ dx: number; dy: number; dz: number; status: "healthy" | "warning" | "critical" }>;
}

const regions: Region[] = [
    {
        id: "us-east-1", label: "us-east-1", sublabel: "8 Nodes", cx: 175, cy: 230, color: "#3fb950",
        nodes: [
            { dx: 0, dy: 0, dz: 0, status: "healthy" }, { dx: 1, dy: 0, dz: 0, status: "healthy" },
            { dx: 0, dy: 1, dz: 0, status: "healthy" }, { dx: 1, dy: 1, dz: 0, status: "healthy" },
            { dx: 0, dy: 0, dz: 1, status: "healthy" }, { dx: 1, dy: 0, dz: 1, status: "healthy" },
            { dx: 0, dy: 1, dz: 1, status: "healthy" }, { dx: 1, dy: 1, dz: 1, status: "warning" },
        ],
    },
    {
        id: "ap-southeast-1", label: "ap-southeast-1", sublabel: "4 Nodes", cx: 440, cy: 100, color: "#3fb950",
        nodes: [
            { dx: 0, dy: 0, dz: 0, status: "healthy" }, { dx: 1, dy: 0, dz: 0, status: "healthy" },
            { dx: 0, dy: 1, dz: 0, status: "healthy" }, { dx: 1, dy: 1, dz: 0, status: "healthy" },
        ],
    },
    {
        id: "us-west-2", label: "us-west-2", sublabel: "6 Nodes", cx: 320, cy: 380, color: "#a371f7",
        nodes: [
            { dx: 0, dy: 0, dz: 0, status: "healthy" }, { dx: 1, dy: 0, dz: 0, status: "healthy" },
            { dx: 0, dy: 1, dz: 0, status: "healthy" }, { dx: 1, dy: 1, dz: 0, status: "healthy" },
            { dx: 0, dy: 0, dz: 1, status: "healthy" }, { dx: 1, dy: 0, dz: 1, status: "healthy" },
        ],
    },
    {
        id: "eu-central-1", label: "eu-central-1", sublabel: "6 Nodes", cx: 700, cy: 280, color: "#f0883e",
        nodes: [
            { dx: 0, dy: 0, dz: 0, status: "warning" }, { dx: 1, dy: 0, dz: 0, status: "healthy" },
            { dx: 0, dy: 1, dz: 0, status: "warning" }, { dx: 1, dy: 1, dz: 0, status: "critical" },
            { dx: 0, dy: 0, dz: 1, status: "healthy" }, { dx: 1, dy: 0, dz: 1, status: "warning" },
        ],
    },
];

const STATUS_COLOR: Record<string, string> = {
    healthy: "#3fb950",
    warning: "#f0883e",
    critical: "#f85149",
    draining: "#22d3ee",
    offline: "#94a3b8",
};

// Convert (x,y,z) to isometric 2D coords
function iso(x: number, y: number, z: number) {
    const isoX = (x - y) * 18;
    const isoY = (x + y) * 9 - z * 22;
    return { x: isoX, y: isoY };
}

type ViewType = "Traffic View" | "Health View" | "Region View";

export function ClusterTopology3D() {
    const [hovered, setHovered] = useState<string | null>(null);
    const [viewOpen, setViewOpen] = useState(false);
    const [view, setView] = useState<ViewType>("Traffic View");
    const [zoom, setZoom] = useState(1);
    const [is3D, setIs3D] = useState(true);
    const [regions, setRegions] = useState<Region[]>([]);

    useEffect(() => {
        async function load() {
            try {
                const state = await getClusterState().catch(() => null);
                if (state && state.nodes && state.nodes.length > 0) {
                    // Group nodes by their role or IP prefix as "regions"
                    const grouped: Record<string, NodeInfo[]> = {};
                    state.nodes.forEach(n => {
                        const key = n.role || "default";
                        if (!grouped[key]) grouped[key] = [];
                        grouped[key].push(n);
                    });
                    const positions = [{ cx: 175, cy: 230 }, { cx: 440, cy: 100 }, { cx: 320, cy: 380 }, { cx: 700, cy: 280 }];
                    const colors = ["#3fb950", "#3fb950", "#a371f7", "#f0883e"];
                    const mapped: Region[] = Object.entries(grouped).map(([key, nodes], i) => ({
                        id: key,
                        label: key,
                        sublabel: `${nodes.length} Nodes`,
                        cx: positions[i % positions.length].cx,
                        cy: positions[i % positions.length].cy,
                        color: colors[i % colors.length],
                        nodes: nodes.map((n, j) => ({
                            dx: j % 2,
                            dy: Math.floor(j / 2) % 2,
                            dz: Math.floor(j / 4),
                            status: n.status === "Ready" ? "healthy" : "warning",
                        })),
                    }));
                    setRegions(mapped);
                }
            } catch { }
        }
        load();
        const interval = setInterval(load, 15000);
        return () => clearInterval(interval);
    }, []);

    // Data-driven sizing: total nodes determines canvas height
    const totalNodes = regions.reduce((sum, r) => sum + r.nodes.length, 0);
    // Compact: 220–300px so topology stays medium-sized
    const dynamicHeight = Math.max(220, Math.min(300, 180 + totalNodes * 4));

    return (
        <div className="rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] flex flex-col overflow-hidden h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(15,23,42,0.10)]">
                <div className="flex items-center gap-2.5">
                    <h3 className="text-[14px] font-semibold text-[#f7f8f8]">Cluster Topology</h3>
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#3fb950]/10 border border-[#3fb950]/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950]" style={{ boxShadow: "0 0 6px #3fb950", animation: "wi-pulse 2s infinite" }} />
                        <span className="text-[10px] text-[#3fb950] font-semibold">Live</span>
                    </div>
                </div>
                <div className="relative" data-popover>
                    <button
                        onClick={() => setViewOpen(o => !o)}
                        className="flex items-center gap-1 h-7 px-2.5 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] text-[11px] text-[#f7f8f8] hover:border-[rgba(15,23,42,0.20)] transition-colors"
                    >
                        {view}
                        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" className={`transition-transform ${viewOpen ? "rotate-180" : ""}`}>
                            <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                    {viewOpen && (
                        <div className="absolute top-full mt-1 right-0 z-30 w-32 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] shadow-[0_8px_24px_rgba(0,0,0,0.5)] py-1">
                            {(["Traffic View", "Health View", "Region View"] as const).map(v => (
                                <button
                                    key={v}
                                    onClick={() => { setView(v); setViewOpen(false); }}
                                    className={`w-full text-left px-3 py-1.5 text-[11.5px] hover:bg-[rgba(15,23,42,0.10)] transition-colors ${view === v ? "text-[#7170ff]" : "text-[#f7f8f8]"}`}
                                >{v}</button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Canvas (fills the rest of the card; min-height ensures content fits) */}
            <div
                className="relative w-full flex-1"
                style={{
                    minHeight: `${dynamicHeight}px`,
                    background: `
                        radial-gradient(ellipse 70% 60% at 50% 50%, rgba(76, 29, 149, 0.18) 0%, transparent 65%),
                        radial-gradient(ellipse 50% 40% at 25% 30%, rgba(59, 130, 246, 0.10) 0%, transparent 55%),
                        radial-gradient(ellipse 45% 40% at 80% 70%, rgba(236, 72, 153, 0.08) 0%, transparent 55%),
                        linear-gradient(180deg, #0f1011 0%, #191a1b 50%, #0f1011 100%)
                    `,
                }}
            >
                <Starfield />

                {/* Health legend */}
                <div className="absolute bottom-4 left-3 z-20 px-3 py-2 rounded-md bg-[rgba(255,255,255,0.02)]/85 border border-[rgba(15,23,42,0.10)] backdrop-blur-sm">
                    <div className="space-y-1">
                        <LegendDot color="#3fb950" label="Healthy" />
                        <LegendDot color="#f0883e" label="Warning" />
                        <LegendDot color="#f85149" label="Critical" />
                        <LegendDot color="#22d3ee" label="Draining" />
                        <LegendDot color="#94a3b8" label="Offline" />
                    </div>
                </div>

                {/* Bottom-right controls */}
                <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 px-1.5 py-1 rounded-md bg-[rgba(255,255,255,0.02)]/85 border border-[rgba(15,23,42,0.14)] backdrop-blur-sm">
                    <CtrlBtn onClick={() => setZoom(z => Math.min(z + 0.1, 2))} title="Zoom in">+</CtrlBtn>
                    <CtrlBtn onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))} title="Zoom out">−</CtrlBtn>
                    <CtrlBtn title="Fit to screen" onClick={() => setZoom(1)}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
                        </svg>
                    </CtrlBtn>
                    <button onClick={() => setIs3D(d => !d)} className={`flex items-center gap-1 h-6 px-2 rounded text-[11px] font-semibold transition-colors ${is3D ? "bg-[#7170ff]/20 text-[#7170ff]" : "text-[#64748b] hover:text-[#f7f8f8]"}`}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
                            <line x1="12" y1="22" x2="12" y2="15.5" />
                            <polyline points="22 8.5 12 15.5 2 8.5" />
                        </svg>
                        {is3D ? "3D View" : "2D View"}
                    </button>
                </div>

                {/* SVG */}
                <svg viewBox="0 0 880 480" className="absolute inset-0 w-full h-full z-10" preserveAspectRatio="xMidYMid meet">
                    <defs>
                        <radialGradient id="hub-grad">
                            <stop offset="0%" stopColor="#7170ff" stopOpacity="0.6" />
                            <stop offset="100%" stopColor="#7170ff" stopOpacity="0" />
                        </radialGradient>
                        <filter id="t3-glow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="2.5" result="b" />
                            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                        </filter>
                    </defs>

                    <g style={{ transform: `scale(${zoom})`, transformOrigin: "440px 240px", transition: "transform 0.3s" }}>
                        {/* Connection lines from center hub to regions */}
                        {regions.map((r, i) => {
                            const isHL = hovered === r.id;
                            const opacity = hovered ? (isHL ? 1 : 0.2) : 0.85;
                            const color = view === "Health View" ? r.color : "#7170ff";
                            return (
                                <g key={`line-${i}`} style={{ opacity }}>
                                    <path
                                        d={`M440,240 Q${(440 + r.cx) / 2},${(240 + r.cy) / 2 - 30} ${r.cx},${r.cy}`}
                                        fill="none"
                                        stroke={color}
                                        strokeWidth="2"
                                        strokeOpacity="0.7"
                                        className="wi-flow-medium"
                                        strokeDasharray="6 3"
                                        style={{ filter: `drop-shadow(0 0 3px ${color})` }}
                                    />
                                    <circle r="2" fill="#fff">
                                        <animateMotion dur={`${1.8 + i * 0.3}s`} repeatCount="indefinite" path={`M440,240 Q${(440 + r.cx) / 2},${(240 + r.cy) / 2 - 30} ${r.cx},${r.cy}`} />
                                    </circle>
                                </g>
                            );
                        })}

                        {/* Center hub - Kubernetes wheel logo */}
                        <g transform="translate(440, 240)">
                            <circle r="50" fill="url(#hub-grad)" />
                            <circle r="22" fill="#191a1b" stroke="#7170ff" strokeWidth="2" filter="url(#t3-glow)" />
                            <KubernetesLogo />
                        </g>

                        {/* regions */}
                        {regions.map(r => (
                            <g
                                key={r.id}
                                onMouseEnter={() => setHovered(r.id)}
                                onMouseLeave={() => setHovered(null)}
                                style={{ cursor: "pointer", transform: hovered === r.id ? "scale(1.05)" : "scale(1)", transformOrigin: `${r.cx}px ${r.cy}px`, transition: "transform 0.2s" }}
                            >
                                <RegionCluster region={r} is3D={is3D} />
                            </g>
                        ))}
                    </g>
                </svg>
            </div>
        </div>
    );
}

// ─── Region Cluster (group of cubes) ─────────────────────────────────────────

function RegionCluster({ region, is3D }: { region: Region; is3D: boolean }) {
    return (
        <g transform={`translate(${region.cx}, ${region.cy})`}>
            {/* Region label */}
            <text x="0" y={-58} textAnchor="middle" fontSize="13" fontWeight="600" fill="#f7f8f8" style={{ filter: "drop-shadow(0 0 4px rgba(0,0,0,0.8))" }}>
                {region.label}
            </text>
            <text x="0" y={-44} textAnchor="middle" fontSize="11" fill="#64748b" fontFamily="var(--font-mono)">
                {region.sublabel}
            </text>

            {/* Cubes (sorted back-to-front for proper 3D layering) */}
            {region.nodes
                .map((n, i) => ({ ...n, i, ...iso(n.dx, n.dy, n.dz) }))
                .sort((a, b) => a.y - b.y)
                .map(n => (
                    <g key={n.i} transform={`translate(${n.x}, ${n.y})`}>
                        <IsoCube color={STATUS_COLOR[n.status]} flat={!is3D} />
                    </g>
                ))}
        </g>
    );
}

// ─── Single isometric cube ───────────────────────────────────────────────────

function IsoCube({ color, flat }: { color: string; flat?: boolean }) {
    if (flat) {
        // 2D top-down square
        return (
            <g style={{ filter: `drop-shadow(0 0 5px ${color})` }}>
                <rect x="-14" y="-14" width="28" height="28" rx="3" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="1.6" />
                <rect x="-9" y="-9" width="18" height="18" rx="2" fill={color} fillOpacity="0.5" />
            </g>
        );
    }
    // Isometric 3D cube
    const s = 16;
    return (
        <g style={{ filter: `drop-shadow(0 0 5px ${color}) drop-shadow(0 0 10px ${color})` }}>
            {/* Top face */}
            <path d={`M0,${-s} L${s},${-s / 2} L0,0 L${-s},${-s / 2} Z`} fill={color} fillOpacity="0.85" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
            {/* Left face */}
            <path d={`M${-s},${-s / 2} L0,0 L0,${s} L${-s},${s / 2} Z`} fill={color} fillOpacity="0.45" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
            {/* Right face */}
            <path d={`M${s},${-s / 2} L0,0 L0,${s} L${s},${s / 2} Z`} fill={color} fillOpacity="0.65" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
            {/* Top inner highlight */}
            <path d={`M0,${-s + 3} L${s - 3},${-s / 2 + 1.5} L0,-1.5 L${-s + 3},${-s / 2 + 1.5} Z`} fill="#fff" fillOpacity="0.18" />
        </g>
    );
}

function KubernetesLogo() {
    // Simplified K8s 7-pointed wheel
    return (
        <g style={{ filter: "drop-shadow(0 0 6px #7170ff)" }}>
            <circle r="14" fill="none" stroke="#7170ff" strokeWidth="1.5" />
            {[0, 1, 2, 3, 4, 5, 6].map(i => {
                const a = (i / 7) * Math.PI * 2 - Math.PI / 2;
                return (
                    <line
                        key={i}
                        x1={Math.cos(a) * 5}
                        y1={Math.sin(a) * 5}
                        x2={Math.cos(a) * 13}
                        y2={Math.sin(a) * 13}
                        stroke="#7170ff"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                    />
                );
            })}
            <circle r="5" fill="#7170ff" fillOpacity="0.8" />
        </g>
    );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function LegendDot({ color, label }: { color: string; label: string }) {
    return (
        <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 4px ${color}` }} />
            <span className="text-[10px] text-[#64748b]">{label}</span>
        </div>
    );
}

function CtrlBtn({ children, onClick, title }: { children: React.ReactNode; onClick?: () => void; title?: string }) {
    return (
        <button onClick={onClick} title={title} className="w-6 h-6 rounded flex items-center justify-center text-[#64748b] hover:text-[#f7f8f8] hover:bg-[rgba(15,23,42,0.10)] transition-colors text-[12px] font-light">
            {children}
        </button>
    );
}

function Starfield() {
    const stars = Array.from({ length: 70 }, (_, i) => {
        const s1 = (i * 9301 + 49297) % 233280 / 233280;
        const s2 = (i * 1103 + 12345) % 65536 / 65536;
        const s3 = (i * 8121 + 28411) % 134456 / 134456;
        return { x: s1 * 100, y: s2 * 100, size: s3 * 1.2 + 0.4, opacity: s3 * 0.5 + 0.2, delay: s1 * 3 };
    });
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {stars.map((s, i) => (
                <div key={i} className="absolute rounded-full" style={{
                    left: `${s.x}%`, top: `${s.y}%`, width: `${s.size}px`, height: `${s.size}px`,
                    backgroundColor: i % 5 === 0 ? "#c4b5fd" : i % 7 === 0 ? "#a5b4fc" : "#cbd5e1",
                    opacity: s.opacity, boxShadow: i % 9 === 0 ? `0 0 3px currentColor` : undefined,
                    animation: `wi-pulse ${2.5 + s.delay}s ease-in-out infinite`, animationDelay: `${s.delay}s`,
                }} />
            ))}
        </div>
    );
}
