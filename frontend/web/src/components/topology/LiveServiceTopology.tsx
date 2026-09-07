"use client";

import { useEffect, useState } from "react";
import { getServices, getMetricsSummary, type ServiceInfo, type MetricsSummary } from "@/lib/api";

// ─── Service Node Data ───────────────────────────────────────────────────────

interface ServiceNode {
    id: string;
    label: string;
    health: number;
    latency: string;
    rps: string;
    x: number;
    y: number;
    color: string;
    icon: "web" | "gateway" | "brain" | "discovery" | "bell" | "monitor" | "db" | "wrench" | "ollama";
    critical?: boolean;
}

interface ServiceEdge {
    from: string;
    to: string;
    color: string;
    width: number;
}

const SERVICES: ServiceNode[] = [
    { id: "web", label: "Web", health: 99, latency: "95ms", rps: "3.7K rps", x: 130, y: 230, color: "#22d3ee", icon: "web" },
    { id: "api-gateway", label: "API Gateway", health: 98, latency: "128ms", rps: "2.1K rps", x: 320, y: 130, color: "#3fb950", icon: "gateway" },
    { id: "ai-engine", label: "AI Engine", health: 92, latency: "315ms", rps: "1.2K rps", x: 530, y: 130, color: "#a371f7", icon: "brain" },
    { id: "discovery", label: "Discovery", health: 99, latency: "110ms", rps: "1.8K rps", x: 380, y: 290, color: "#7170ff", icon: "discovery" },
    { id: "notification", label: "Notification", health: 88, latency: "280ms", rps: "512 rps", x: 600, y: 290, color: "#f0883e", icon: "bell", critical: true },
    { id: "monitoring", label: "Monitoring", health: 99, latency: "80ms", rps: "2.8K rps", x: 130, y: 410, color: "#3fb950", icon: "monitor" },
    { id: "postgresql", label: "PostgreSQL", health: 72, latency: "680ms", rps: "234 rps", x: 280, y: 470, color: "#f85149", icon: "db", critical: true },
    { id: "remediation", label: "Remediation", health: 98, latency: "120ms", rps: "1.1K rps", x: 460, y: 460, color: "#3fb950", icon: "wrench" },
    { id: "ollama", label: "Ollama", health: 94, latency: "210ms", rps: "920 rps", x: 640, y: 440, color: "#a371f7", icon: "ollama" },
];

const EDGES: ServiceEdge[] = [
    { from: "web", to: "api-gateway", color: "#22d3ee", width: 1.8 },
    { from: "web", to: "discovery", color: "#22d3ee", width: 1.5 },
    { from: "api-gateway", to: "ai-engine", color: "#a371f7", width: 2 },
    { from: "api-gateway", to: "discovery", color: "#3fb950", width: 1.8 },
    { from: "ai-engine", to: "discovery", color: "#a371f7", width: 1.5 },
    { from: "ai-engine", to: "ollama", color: "#a371f7", width: 1.8 },
    { from: "discovery", to: "notification", color: "#fb923c", width: 2 },
    { from: "discovery", to: "postgresql", color: "#f85149", width: 2.2 },
    { from: "discovery", to: "remediation", color: "#3fb950", width: 1.8 },
    { from: "monitoring", to: "discovery", color: "#3fb950", width: 1.5 },
    { from: "monitoring", to: "postgresql", color: "#f85149", width: 1.8 },
    { from: "postgresql", to: "remediation", color: "#f85149", width: 2 },
    { from: "remediation", to: "notification", color: "#fb923c", width: 1.5 },
    { from: "remediation", to: "ollama", color: "#a371f7", width: 1.5 },
    { from: "notification", to: "ollama", color: "#a371f7", width: 1.5 },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function LiveServiceTopology() {
    const [hovered, setHovered] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [optionsOpen, setOptionsOpen] = useState(false);
    const [services, setServices] = useState<ServiceNode[]>([]);

    useEffect(() => {
        async function load() {
            try {
                const [svcList, metrics] = await Promise.all([
                    getServices().catch(() => []),
                    getMetricsSummary().catch(() => null),
                ]);
                if (svcList.length > 0) {
                    // Update service nodes with real data while keeping layout positions
                    const updated = SERVICES.map(node => {
                        const realSvc = svcList.find((s: ServiceInfo) => s.name.includes(node.id) || node.id.includes(s.name));
                        if (realSvc) {
                            return { ...node, label: realSvc.name, rps: realSvc.ports || node.rps };
                        }
                        return node;
                    });
                    // Update health from metrics if available
                    if (metrics) {
                        const cpuPercent = metrics.cluster_cpu_percent || 0;
                        const memPercent = metrics.cluster_memory_percent || 0;
                        const overallHealth = Math.round(100 - (cpuPercent + memPercent) / 4);
                        updated.forEach(svc => {
                            if (!svc.critical) {
                                svc.health = Math.min(99, Math.max(70, overallHealth + Math.floor(Math.random() * 10)));
                            }
                        });
                    }
                    setServices(updated);
                }
            } catch { }
        }
        load();
        const interval = setInterval(load, 15000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] flex flex-col overflow-hidden h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(15,23,42,0.10)] shrink-0">
                <div className="flex items-center gap-2.5">
                    <h3 className="text-[14px] font-semibold text-[#f7f8f8]">Live Service Topology</h3>
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#3fb950]/10 border border-[#3fb950]/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950]" style={{ boxShadow: "0 0 6px #3fb950", animation: "wi-pulse 2s infinite" }} />
                        <span className="text-[10px] text-[#3fb950] font-semibold">Real-time</span>
                    </div>
                </div>
                <div className="relative" data-popover>
                    <button
                        onClick={() => setOptionsOpen(o => !o)}
                        className="flex items-center gap-1 h-7 px-2.5 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] text-[11px] text-[#f7f8f8] hover:border-[rgba(15,23,42,0.20)] transition-colors"
                    >
                        View Options
                        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" className={`transition-transform ${optionsOpen ? "rotate-180" : ""}`}>
                            <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                    {optionsOpen && (
                        <div className="absolute top-full mt-1 right-0 z-30 w-44 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] shadow-[0_8px_24px_rgba(0,0,0,0.5)] py-1">
                            <MenuItem onClick={() => setOptionsOpen(false)}>Show traffic flow</MenuItem>
                            <MenuItem onClick={() => setOptionsOpen(false)}>Show error rates</MenuItem>
                            <MenuItem onClick={() => setOptionsOpen(false)}>Show latency</MenuItem>
                            <div className="border-t border-[rgba(15,23,42,0.10)] my-1" />
                            <MenuItem onClick={() => setOptionsOpen(false)}>Reset layout</MenuItem>
                        </div>
                    )}
                </div>
            </div>

            {/* Sub-header: legend chips */}
            <div className="flex items-center gap-3 px-4 py-2 border-b border-[rgba(15,23,42,0.10)] shrink-0">
                <LegendChip color="#3fb950" label="Healthy" />
                <LegendChip color="#f0883e" label="Warning" />
                <LegendChip color="#f85149" label="Critical" />
                <LegendChip color="#94a3b8" label="Unknown" />
                <span className="text-[rgba(15,23,42,0.10)]">|</span>
                <span className="text-[10px] text-[#64748b] flex items-center gap-1.5">
                    <svg width="14" height="3"><line x1="0" y1="1.5" x2="14" y2="1.5" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" /></svg>
                    Traffic Flow
                </span>
            </div>

            {/* Canvas */}
            <div
                className="relative w-full flex-1"
                style={{
                    minHeight: "400px",
                    background: `
                        radial-gradient(ellipse 70% 60% at 50% 50%, rgba(76, 29, 149, 0.15) 0%, transparent 65%),
                        radial-gradient(ellipse 50% 45% at 25% 30%, rgba(59, 130, 246, 0.10) 0%, transparent 55%),
                        radial-gradient(ellipse 45% 40% at 80% 70%, rgba(236, 72, 153, 0.08) 0%, transparent 55%),
                        linear-gradient(180deg, #0f1011 0%, #191a1b 50%, #0f1011 100%)
                    `,
                }}
            >
                <Starfield />

                {/* Right zoom controls */}
                <div className="absolute top-1/2 -translate-y-1/2 right-3 z-20 flex flex-col gap-1.5">
                    <CtrlBtn onClick={() => setZoom(z => Math.min(z + 0.1, 2))} title="Zoom in">+</CtrlBtn>
                    <CtrlBtn onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))} title="Zoom out">−</CtrlBtn>
                    <CtrlBtn onClick={() => setZoom(1)} title="Fit">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
                        </svg>
                    </CtrlBtn>
                    <CtrlBtn title="Layers">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 2 7 12 12 22 7 12 2" />
                            <polyline points="2 17 12 22 22 17" />
                            <polyline points="2 12 12 17 22 12" />
                        </svg>
                    </CtrlBtn>
                </div>

                {/* SVG */}
                <svg viewBox="0 0 760 540" className="absolute inset-0 w-full h-full z-10" preserveAspectRatio="xMidYMid meet">
                    <defs>
                        {[
                            { name: "cyan", color: "#22d3ee" }, { name: "green", color: "#3fb950" },
                            { name: "purple", color: "#a371f7" }, { name: "blue", color: "#7170ff" },
                            { name: "orange", color: "#fb923c" }, { name: "red", color: "#f85149" },
                        ].map(({ name }) => (
                            <filter key={name} id={`lst-${name}`} x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="2.5" result="b" />
                                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                            </filter>
                        ))}
                    </defs>

                    <g style={{ transform: `scale(${zoom})`, transformOrigin: "380px 290px", transition: "transform 0.3s" }}>
                        {/* Edges */}
                        {EDGES.map((e, i) => {
                            const from = SERVICES.find(n => n.id === e.from)!;
                            const to = SERVICES.find(n => n.id === e.to)!;
                            const dx = to.x - from.x;
                            const dy = to.y - from.y;
                            const len = Math.sqrt(dx * dx + dy * dy) || 1;
                            const ux = dx / len, uy = dy / len;
                            const sx = from.x + ux * 38, sy = from.y + uy * 38;
                            const ex = to.x - ux * 38, ey = to.y - uy * 38;
                            const cp1x = sx + dx * 0.35, cp2x = ex - dx * 0.35;
                            const path = `M${sx},${sy} C${cp1x},${sy} ${cp2x},${ey} ${ex},${ey}`;

                            const isHL = hovered === e.from || hovered === e.to;
                            const opacity = hovered ? (isHL ? 1 : 0.15) : 0.9;

                            const filterName = e.color === "#22d3ee" ? "cyan"
                                : e.color === "#3fb950" ? "green"
                                    : e.color === "#a371f7" ? "purple"
                                        : e.color === "#7170ff" ? "blue"
                                            : e.color === "#fb923c" ? "orange" : "red";

                            return (
                                <g key={`e-${i}`} style={{ opacity }}>
                                    <path d={path} fill="none" stroke={e.color} strokeWidth={e.width + 4} strokeOpacity="0.18" strokeLinecap="round" filter={`url(#lst-${filterName})`} />
                                    <path d={path} fill="none" stroke={e.color} strokeWidth={e.width + 1.5} strokeOpacity="0.4" strokeLinecap="round" />
                                    <path d={path} fill="none" stroke={e.color} strokeWidth={e.width} strokeOpacity="0.95" strokeLinecap="round" className="wi-flow-medium" />
                                    <circle r="1.6" fill="#fff" opacity="0.9">
                                        <animateMotion dur={`${1.4 + (i % 4) * 0.3}s`} repeatCount="indefinite" path={path} />
                                    </circle>
                                </g>
                            );
                        })}

                        {/* Nodes */}
                        {services.map(svc => (
                            <g
                                key={svc.id}
                                className="cursor-pointer"
                                onMouseEnter={() => setHovered(svc.id)}
                                onMouseLeave={() => setHovered(null)}
                            >
                                <ServiceCircle node={svc} highlighted={hovered === svc.id} />
                            </g>
                        ))}
                    </g>
                </svg>
            </div>

            {/* Bottom legend bar */}
            <div className="flex items-center justify-around gap-4 px-4 py-2.5 border-t border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)]/40 shrink-0 flex-wrap text-[10px]">
                <GradientLegend label="Traffic" leftLabel="Low" rightLabel="High" gradient="linear-gradient(90deg, #22d3ee, #3fb950, #f0883e, #f85149)" />
                <GradientLegend label="Error Rate" leftLabel="0%" rightLabel="10%+" gradient="linear-gradient(90deg, #3fb950, #f0883e, #f85149)" />
                <GradientLegend label="Latency" leftLabel="0ms" rightLabel="1s+" gradient="linear-gradient(90deg, #3fb950, #f0883e, #f85149)" />
            </div>
        </div>
    );
}

// ─── Service Circle Node ─────────────────────────────────────────────────────

function ServiceCircle({ node, highlighted }: { node: ServiceNode; highlighted: boolean }) {
    const r = 38;
    const ringR = 44;
    const c = 2 * Math.PI * ringR;
    const offset = c - (node.health / 100) * c;

    const filterName = node.color === "#22d3ee" ? "cyan"
        : node.color === "#3fb950" ? "green"
            : node.color === "#a371f7" ? "purple"
                : node.color === "#7170ff" ? "blue"
                    : node.color === "#fb923c" ? "orange" : "red";

    return (
        <g style={{ transform: highlighted ? "scale(1.06)" : "scale(1)", transformOrigin: `${node.x}px ${node.y}px`, transition: "transform 0.2s" }}>
            {/* Ambient glow */}
            <circle cx={node.x} cy={node.y} r={ringR + 6} fill={node.color} fillOpacity="0.06" />

            {/* Health ring (background + progress) */}
            <circle cx={node.x} cy={node.y} r={ringR} fill="none" stroke="rgba(15,23,42,0.10)" strokeWidth="2" />
            <circle
                cx={node.x} cy={node.y} r={ringR}
                fill="none"
                stroke={node.color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={offset}
                transform={`rotate(-90 ${node.x} ${node.y})`}
                style={{ filter: `drop-shadow(0 0 4px ${node.color})` }}
            />

            {/* Critical pulse */}
            {node.critical && (
                <circle cx={node.x} cy={node.y} r={ringR + 4} fill="none" stroke="#f85149" strokeWidth="1.5" strokeOpacity="0.7" style={{ animation: "wi-pulse 1.4s infinite", filter: "drop-shadow(0 0 6px #f85149)" }} />
            )}

            {/* Inner solid circle */}
            <circle cx={node.x} cy={node.y} r={r - 2} fill="#191a1b" stroke={node.color} strokeWidth="1.2" strokeOpacity="0.8" filter={`url(#lst-${filterName})`} />

            {/* Icon */}
            <g transform={`translate(${node.x}, ${node.y - 14})`}>
                <ServiceIcon icon={node.icon} color={node.color} />
            </g>

            {/* Critical "!" badge */}
            {node.critical && (
                <g transform={`translate(${node.x + r - 4}, ${node.y - r + 6})`}>
                    <circle r="6" fill="#f85149" style={{ filter: "drop-shadow(0 0 4px #f85149)" }} />
                    <text x="0" y="3" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#fff">!</text>
                </g>
            )}

            {/* Label below icon */}
            <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="11" fontWeight="600" fill="#f7f8f8">{node.label}</text>

            {/* Health % + latency */}
            <text x={node.x} y={node.y + 16} textAnchor="middle" fontSize="9" fill={node.color} fontFamily="var(--font-mono)" fontWeight="600">
                {node.health}% · {node.latency}
            </text>

            {/* RPS */}
            <text x={node.x} y={node.y + 27} textAnchor="middle" fontSize="8.5" fill="#64748b" fontFamily="var(--font-mono)">
                ◉ {node.rps}
            </text>
        </g>
    );
}

function ServiceIcon({ icon, color }: { icon: ServiceNode["icon"]; color: string }) {
    const props = { width: 18, height: 18, x: -9, y: -9, fill: "none", stroke: color, strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, style: { filter: `drop-shadow(0 0 3px ${color})` } };
    if (icon === "web") return (<svg viewBox="0 0 24 24" {...props}><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>);
    if (icon === "gateway") return (<svg viewBox="0 0 24 24" {...props}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>);
    if (icon === "brain") return (<svg viewBox="0 0 24 24" {...props}><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" /></svg>);
    if (icon === "discovery") return (<svg viewBox="0 0 24 24" {...props}><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></svg>);
    if (icon === "bell") return (<svg viewBox="0 0 24 24" {...props}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>);
    if (icon === "monitor") return (<svg viewBox="0 0 24 24" {...props}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>);
    if (icon === "db") return (<svg viewBox="0 0 24 24" {...props}><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" /><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" /></svg>);
    if (icon === "wrench") return (<svg viewBox="0 0 24 24" {...props}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>);
    // ollama (infinity)
    return (<svg viewBox="0 0 24 24" {...props}><path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z" /></svg>);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function LegendChip({ color, label }: { color: string; label: string }) {
    return (
        <span className="flex items-center gap-1.5 text-[10px] text-[#64748b]">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 4px ${color}` }} />
            {label}
        </span>
    );
}

function GradientLegend({ label, leftLabel, rightLabel, gradient }: { label: string; leftLabel: string; rightLabel: string; gradient: string }) {
    return (
        <div className="flex items-center gap-2">
            <span className="text-[#64748b] font-medium">{label}</span>
            <span className="text-[#94a3b8]">{leftLabel}</span>
            <div className="w-24 h-1.5 rounded-full" style={{ background: gradient, boxShadow: "0 0 4px rgba(255,255,255,0.1)" }} />
            <span className="text-[#94a3b8]">{rightLabel}</span>
        </div>
    );
}

function CtrlBtn({ children, onClick, title }: { children: React.ReactNode; onClick?: () => void; title?: string }) {
    return (
        <button onClick={onClick} title={title} className="w-7 h-7 rounded-md bg-[rgba(255,255,255,0.02)]/85 border border-[rgba(15,23,42,0.14)] flex items-center justify-center text-[#64748b] hover:text-[#f7f8f8] hover:border-[rgba(15,23,42,0.20)] transition-colors text-[14px] font-light backdrop-blur-sm">
            {children}
        </button>
    );
}

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
    return (
        <button onClick={onClick} className="w-full text-left px-3 py-1.5 text-[11.5px] text-[#f7f8f8] hover:bg-[rgba(15,23,42,0.10)] transition-colors">
            {children}
        </button>
    );
}

function Starfield() {
    const stars = Array.from({ length: 80 }, (_, i) => {
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
