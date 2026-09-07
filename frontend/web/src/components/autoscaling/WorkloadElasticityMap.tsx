"use client";

import { useEffect, useState } from "react";
import { getAutoscaling } from "@/lib/api";

// ─── Workload Elasticity Map (space background + double-ring circles) ────────

const FALLBACK_NODES = [
    { label: "API Gateway", ratio: "8 / 10", pressure: "Medium", x: 320, y: 80, color: "#3fb950", ringColor: "#3fb950", r: 42 },
    { label: "Monitoring", ratio: "4 / 4", pressure: "Low", x: 120, y: 200, color: "#7170ff", ringColor: "#7170ff", r: 38 },
    { label: "AI Engine", ratio: "3 / 6", pressure: "High", x: 320, y: 240, color: "#f85149", ringColor: "#f85149", r: 52 },
    { label: "Checkout", ratio: "6 / 6", pressure: "High", x: 540, y: 160, color: "#f85149", ringColor: "#f85149", r: 40 },
    { label: "PostgreSQL", ratio: "5 / 5", pressure: "Low", x: 140, y: 380, color: "#7170ff", ringColor: "#7170ff", r: 36 },
    { label: "Notifications", ratio: "3 / 5", pressure: "Medium", x: 340, y: 420, color: "#f0883e", ringColor: "#f0883e", r: 36 },
    { label: "Web Frontend", ratio: "4 / 8", pressure: "Medium", x: 540, y: 340, color: "#22d3ee", ringColor: "#22d3ee", r: 40 },
];

const FALLBACK_EDGES: number[][] = [
    [0, 2], [0, 3], [1, 2], [2, 3], [2, 5], [4, 2], [5, 6], [3, 6],
];

function derivePressure(current: number, max: number): "Low" | "Medium" | "High" {
    const ratio = current / max;
    if (ratio >= 0.8) return "High";
    if (ratio >= 0.5) return "Medium";
    return "Low";
}

function pressureColor(pressure: string) {
    if (pressure === "High") return "#f85149";
    if (pressure === "Medium") return "#f0883e";
    return "#7170ff";
}

const NODE_POSITIONS = [
    { x: 320, y: 80, r: 42 },
    { x: 120, y: 200, r: 38 },
    { x: 320, y: 240, r: 52 },
    { x: 540, y: 160, r: 40 },
    { x: 140, y: 380, r: 36 },
    { x: 340, y: 420, r: 36 },
    { x: 540, y: 340, r: 40 },
];

export function WorkloadElasticityMap() {
    const [nodes, setNodes] = useState<typeof FALLBACK_NODES>([]);
    const [edges] = useState<number[][]>([]);

    useEffect(() => {
        let active = true;
        const fetchData = () => {
            getAutoscaling()
                .then((data) => {
                    if (!active) return;
                    const mapped = data.hpas.slice(0, 7).map((hpa, i) => {
                        const pos = NODE_POSITIONS[i] || NODE_POSITIONS[0];
                        const pressure = derivePressure(hpa.current, hpa.max);
                        const color = pressureColor(pressure);
                        return {
                            label: hpa.name,
                            ratio: `${hpa.current} / ${hpa.max}`,
                            pressure,
                            x: pos.x,
                            y: pos.y,
                            color,
                            ringColor: color,
                            r: pos.r,
                        };
                    });
                    if (mapped.length > 0) setNodes(mapped);
                })
                .catch(() => { });
        };
        fetchData();
        const interval = setInterval(fetchData, 15_000);
        return () => { active = false; clearInterval(interval); };
    }, []);
    return (
        <div className="rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3.5 relative overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2 relative z-10">
                <h3 className="text-[14px] font-semibold text-[#f7f8f8]">Workload Elasticity Map</h3>
                <span className="w-4 h-4 rounded-full border border-[rgba(15,23,42,0.14)] flex items-center justify-center text-[9px] text-[#64748b]">?</span>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 mb-2 text-[10px] text-[#64748b] relative z-10">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#7170ff]" style={{ boxShadow: "0 0 6px #7170ff" }} /> Low Pressure</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#f0883e]" style={{ boxShadow: "0 0 6px #f0883e" }} /> Medium</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#f85149]" style={{ boxShadow: "0 0 6px #f85149" }} /> High Pressure</span>
            </div>

            {/* Canvas with space background */}
            <div
                className="relative rounded-lg overflow-hidden"
                style={{
                    height: "380px",
                    background: `
                        radial-gradient(ellipse 80% 70% at 50% 50%, rgba(30, 58, 138, 0.20) 0%, transparent 70%),
                        radial-gradient(ellipse 50% 40% at 20% 30%, rgba(59, 130, 246, 0.12) 0%, transparent 55%),
                        radial-gradient(ellipse 40% 35% at 80% 70%, rgba(34, 211, 238, 0.08) 0%, transparent 55%),
                        linear-gradient(180deg, #0f1011 0%, #191a1b 50%, #0f1011 100%)
                    `,
                }}
            >
                {/* Particle starfield */}
                <ParticleField />

                {/* Right-side controls */}
                <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
                    <CtrlBtn>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3" />
                            <line x1="12" y1="1" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="23" />
                            <line x1="1" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="23" y2="12" />
                        </svg>
                    </CtrlBtn>
                    <CtrlBtn>−</CtrlBtn>
                    <CtrlBtn>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" />
                        </svg>
                    </CtrlBtn>
                    <CtrlBtn>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
                        </svg>
                    </CtrlBtn>
                </div>

                {/* SVG */}
                <svg viewBox="0 0 660 480" className="absolute inset-0 w-full h-full z-10" preserveAspectRatio="xMidYMid meet">
                    <defs>
                        {[
                            { name: "wem-red", color: "#f85149" },
                            { name: "wem-green", color: "#3fb950" },
                            { name: "wem-blue", color: "#7170ff" },
                            { name: "wem-orange", color: "#f0883e" },
                            { name: "wem-cyan", color: "#22d3ee" },
                        ].map(({ name, color }) => (
                            <filter key={name} id={name} x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="4" result="b" />
                                <feFlood floodColor={color} floodOpacity="0.5" />
                                <feComposite in2="b" operator="in" />
                                <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
                            </filter>
                        ))}
                    </defs>

                    {/* Connection lines (red/orange) */}
                    {edges.map(([a, b], i) => {
                        const from = nodes[a];
                        const to = nodes[b];
                        const isHigh = from.pressure === "High" || to.pressure === "High";
                        const color = isHigh ? "#f85149" : "#f0883e";
                        return (
                            <line
                                key={i}
                                x1={from.x} y1={from.y}
                                x2={to.x} y2={to.y}
                                stroke={color}
                                strokeWidth="1.5"
                                strokeOpacity="0.5"
                                style={{ filter: `drop-shadow(0 0 3px ${color})` }}
                            />
                        );
                    })}
                    {/* Animated dots on connections */}
                    {edges.slice(0, 5).map(([a, b], i) => {
                        const from = nodes[a];
                        const to = nodes[b];
                        const color = from.pressure === "High" ? "#f85149" : "#f0883e";
                        return (
                            <circle key={`dot-${i}`} r="2" fill={color} opacity="0.9">
                                <animateMotion dur={`${2 + i * 0.4}s`} repeatCount="indefinite" path={`M${from.x},${from.y} L${to.x},${to.y}`} />
                            </circle>
                        );
                    })}

                    {/* Nodes */}
                    {nodes.map((n, i) => {
                        const filterName = n.color === "#f85149" ? "wem-red"
                            : n.color === "#3fb950" ? "wem-green"
                                : n.color === "#7170ff" ? "wem-blue"
                                    : n.color === "#f0883e" ? "wem-orange" : "wem-cyan";
                        const pressureColor = n.pressure === "High" ? "#f85149" : n.pressure === "Medium" ? "#f0883e" : "#7170ff";
                        return (
                            <g key={i}>
                                {/* Outer glow ring */}
                                <circle cx={n.x} cy={n.y} r={n.r + 8} fill="none" stroke={n.ringColor} strokeWidth="1" strokeOpacity="0.3" filter={`url(#${filterName})`} />
                                {/* Main ring */}
                                <circle cx={n.x} cy={n.y} r={n.r} fill="none" stroke={n.ringColor} strokeWidth="2.5" style={{ filter: `drop-shadow(0 0 8px ${n.ringColor})` }} />
                                {/* Inner dark fill */}
                                <circle cx={n.x} cy={n.y} r={n.r - 4} fill="#0f1011" fillOpacity="0.95" stroke={n.ringColor} strokeWidth="0.5" strokeOpacity="0.3" />

                                {/* Hexagonal icon */}
                                <g transform={`translate(${n.x}, ${n.y - 20})`}>
                                    <polygon points="0,-10 9,-5 9,5 0,10 -9,5 -9,-5" fill={`${n.ringColor}20`} stroke={n.ringColor} strokeWidth="1" strokeOpacity="0.7" />
                                    <g style={{ filter: `drop-shadow(0 0 3px ${n.ringColor})` }}>
                                        <path d="M0,-5 L5,-2.5 L0,0 L-5,-2.5 Z" fill={n.ringColor} fillOpacity="0.5" stroke={n.ringColor} strokeWidth="0.5" strokeLinejoin="round" />
                                        <path d="M-5,-2.5 L0,0 L0,5 L-5,2.5 Z" fill={n.ringColor} fillOpacity="0.2" stroke={n.ringColor} strokeWidth="0.5" strokeLinejoin="round" />
                                        <path d="M5,-2.5 L0,0 L0,5 L5,2.5 Z" fill={n.ringColor} fillOpacity="0.35" stroke={n.ringColor} strokeWidth="0.5" strokeLinejoin="round" />
                                    </g>
                                </g>

                                {/* Label */}
                                <text x={n.x} y={n.y + 6} textAnchor="middle" fontSize="12" fontWeight="600" fill="#f7f8f8">{n.label}</text>
                                {/* Ratio */}
                                <text x={n.x} y={n.y + 20} textAnchor="middle" fontSize="11" fill="#f7f8f8" fontFamily="var(--font-mono)" fontWeight="500">{n.ratio}</text>
                                {/* Pressure label */}
                                <text x={n.x} y={n.y + 33} textAnchor="middle" fontSize="10" fill={pressureColor} fontWeight="600" fontStyle="italic">{n.pressure}</text>
                            </g>
                        );
                    })}
                </svg>
            </div>
        </div>
    );
}

function CtrlBtn({ children }: { children: React.ReactNode }) {
    return (
        <button className="w-8 h-8 rounded-lg bg-[rgba(255,255,255,0.02)]/80 border border-[rgba(15,23,42,0.14)] flex items-center justify-center text-[#64748b] hover:text-[#f7f8f8] hover:border-[rgba(15,23,42,0.20)] transition-colors text-[13px] font-light backdrop-blur-sm">
            {children}
        </button>
    );
}

function ParticleField() {
    const particles = Array.from({ length: 120 }, (_, i) => {
        const s1 = (i * 9301 + 49297) % 233280 / 233280;
        const s2 = (i * 1103 + 12345) % 65536 / 65536;
        const s3 = (i * 8121 + 28411) % 134456 / 134456;
        return { x: s1 * 100, y: s2 * 100, size: s3 * 1.8 + 0.5, opacity: s3 * 0.6 + 0.15 };
    });

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map((p, i) => (
                <div
                    key={i}
                    className="absolute rounded-full"
                    style={{
                        left: `${p.x}%`,
                        top: `${p.y}%`,
                        width: `${p.size}px`,
                        height: `${p.size}px`,
                        backgroundColor: i % 4 === 0 ? "#7170ff" : i % 7 === 0 ? "#22d3ee" : i % 11 === 0 ? "#a371f7" : "#1e3a5f",
                        opacity: p.opacity,
                        boxShadow: i % 6 === 0 ? `0 0 4px currentColor` : undefined,
                        animation: i % 8 === 0 ? `wi-pulse ${2 + (i % 5)}s ease-in-out infinite` : undefined,
                    }}
                />
            ))}
            {/* Nebula glow blobs */}
            <div className="absolute top-[20%] left-[40%] w-[200px] h-[200px] rounded-full bg-blue-500/8 blur-[60px]" />
            <div className="absolute bottom-[25%] right-[20%] w-[150px] h-[150px] rounded-full bg-cyan-500/6 blur-[50px]" />
            <div className="absolute top-[50%] left-[15%] w-[120px] h-[120px] rounded-full bg-purple-500/5 blur-[45px]" />
        </div>
    );
}
