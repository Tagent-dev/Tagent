"use client";

import { useEffect, useRef, useState } from "react";
import { Dropdown } from "./Dropdown";
import { getPods, getDeployments, type PodInfo, type DeploymentInfo } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TopoNode {
    id: string;
    label: string;
    sublabel: string;
    color: string;
    // graph layout
    gx: number;
    gy: number;
    // grid layout col/row
    gridCol: number;
    gridRow: number;
    // radial layer (0 center, 1 inner ring, 2 outer)
    radialLayer: number;
    radialAngle: number; // degrees
}

interface TopoEdge {
    from: string;
    to: string;
    traffic: "high" | "medium" | "low" | "idle";
    color?: string;
}

// ─── Dynamic Layout Builder ──────────────────────────────────────────────────

const TRAFFIC_STYLE: Record<string, { color: string; width: number; class: string }> = {
    high: { color: "#ec4899", width: 2.5, class: "wi-flow-high" },
    medium: { color: "#fb923c", width: 2, class: "wi-flow-medium" },
    low: { color: "#22d3ee", width: 1.5, class: "wi-flow-low" },
    idle: { color: "#475569", width: 1, class: "" },
};

const EDGE_COLORS = ["#ec4899", "#f43f5e", "#fb923c", "#22d3ee", "#06b6d4", "#a371f7"];

function buildWorkloadTopology(deployments: DeploymentInfo[], pods: PodInfo[]): { nodes: TopoNode[]; edges: TopoEdge[] } {
    if (deployments.length === 0 && pods.length === 0) return { nodes: [], edges: [] };

    const items = deployments.length > 0
        ? deployments.map(d => ({
            id: d.name,
            label: d.name,
            sublabel: `${d.ready}/${d.replicas} pods`,
            color: d.ready === d.replicas ? "#3fb950" : d.ready === 0 ? "#f85149" : "#f0883e",
            isData: d.name.includes("postgres") || d.name.includes("redis") || d.name.includes("kafka") || d.name.includes("mongo") || d.name.includes("mysql") || d.name.includes("s3") || d.name.includes("minio"),
        }))
        : Array.from(new Set(pods.map(p => p.namespace + "/" + p.name.replace(/-[a-z0-9]+-[a-z0-9]+$/, "")))).slice(0, 12).map(key => {
            const name = key.split("/")[1] || key;
            return { id: name, label: name, sublabel: "—", color: "#64748b", isData: false };
        });

    const services = items.filter(i => !i.isData);
    const dataTier = items.filter(i => i.isData);

    const nodes: TopoNode[] = [];

    // Layout services in columns
    const cx = 440, cy = 240;
    services.forEach((item, i) => {
        const angle = (i / services.length) * 2 * Math.PI - Math.PI / 2;
        const r = 160;
        nodes.push({
            id: item.id,
            label: item.label,
            sublabel: item.sublabel,
            color: item.color,
            gx: cx + r * Math.cos(angle),
            gy: cy + r * Math.sin(angle),
            gridCol: i % 3,
            gridRow: Math.floor(i / 3),
            radialLayer: 1,
            radialAngle: (i / services.length) * 360 - 180,
        });
    });

    // Data tier at outer ring
    dataTier.forEach((item, i) => {
        const angle = (i / Math.max(dataTier.length, 1)) * 2 * Math.PI - Math.PI / 2;
        const r = 280;
        nodes.push({
            id: item.id,
            label: item.label,
            sublabel: item.sublabel,
            color: item.color,
            gx: cx + r * Math.cos(angle),
            gy: cy + r * Math.sin(angle),
            gridCol: 2,
            gridRow: i,
            radialLayer: 2,
            radialAngle: (i / Math.max(dataTier.length, 1)) * 360 - 180,
        });
    });

    // Auto-generate edges
    const edges: TopoEdge[] = [];
    const trafficLevels: TopoEdge["traffic"][] = ["high", "medium", "low", "idle"];
    for (let i = 1; i < nodes.length; i++) {
        const fromIdx = Math.max(0, i - 1 - (i % 3));
        edges.push({
            from: nodes[fromIdx].id,
            to: nodes[i].id,
            traffic: trafficLevels[i % trafficLevels.length],
            color: EDGE_COLORS[i % EDGE_COLORS.length],
        });
    }

    return { nodes, edges };
}

type ViewMode = "graph" | "radial" | "grid";

// ─── Component ───────────────────────────────────────────────────────────────

export function WorkloadTopologyPanel() {
    const [hovered, setHovered] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [locked, setLocked] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>("graph");
    const [layout, setLayout] = useState<"auto" | "horizontal" | "vertical">("auto");
    const [menuOpen, setMenuOpen] = useState(false);
    const [topoNodes, setTopoNodes] = useState<TopoNode[]>([]);
    const [topoEdges, setTopoEdges] = useState<TopoEdge[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);
    const dragState = useRef<{ active: boolean; startX: number; startY: number; origX: number; origY: number } | null>(null);

    // Fetch real deployment/pod data and build topology dynamically
    useEffect(() => {
        async function load() {
            try {
                const [deployments, pods] = await Promise.all([
                    getDeployments().catch(() => []),
                    getPods().catch(() => []),
                ]);
                const topo = buildWorkloadTopology(deployments || [], pods || []);
                setTopoNodes(topo.nodes);
                setTopoEdges(topo.edges);
            } catch { }
        }
        load();
        const interval = setInterval(load, 15000);
        return () => clearInterval(interval);
    }, []);

    // Compute node positions for the active view mode
    const layoutNodes = topoNodes.map(n => {
        if (viewMode === "graph") {
            return { ...n, x: n.gx, y: n.gy };
        }
        if (viewMode === "grid") {
            const colSpacing = 220;
            const rowSpacing = 90;
            const startX = 160;
            const startY = 60;
            return { ...n, x: startX + n.gridCol * colSpacing, y: startY + n.gridRow * rowSpacing };
        }
        // radial
        const cx = 440, cy = 240;
        const radii = [0, 150, 290];
        const r = radii[n.radialLayer];
        const rad = (n.radialAngle * Math.PI) / 180;
        return { ...n, x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    });

    // Reset pan/zoom when changing view mode
    useEffect(() => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    }, [viewMode]);

    // ESC exits fullscreen
    useEffect(() => {
        if (!fullscreen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") setFullscreen(false);
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [fullscreen]);

    // Close kebab menu on outside click
    useEffect(() => {
        if (!menuOpen) return;
        const handler = (e: MouseEvent) => {
            const t = e.target as HTMLElement;
            if (!t.closest("[data-topo-menu]")) setMenuOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [menuOpen]);

    // Wheel-to-zoom
    const handleWheel = (e: React.WheelEvent) => {
        if (locked) return;
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.08 : 0.08;
        setZoom(z => clamp(z + delta, 0.5, 2.5));
    };

    // Drag-to-pan
    const handlePointerDown = (e: React.PointerEvent) => {
        if (locked) return;
        // Only pan when not clicking a node
        const t = e.target as Element;
        if (t.closest("[data-node]")) return;
        (e.target as Element).setPointerCapture?.(e.pointerId);
        dragState.current = { active: true, startX: e.clientX, startY: e.clientY, origX: pan.x, origY: pan.y };
    };
    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragState.current?.active) return;
        const dx = e.clientX - dragState.current.startX;
        const dy = e.clientY - dragState.current.startY;
        setPan({ x: dragState.current.origX + dx, y: dragState.current.origY + dy });
    };
    const handlePointerUp = () => {
        if (dragState.current) dragState.current.active = false;
    };

    const reset = () => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    };

    return (
        <>
            {fullscreen && <div className="fixed inset-0 z-40 bg-[rgba(255,255,255,0.02)]/95 backdrop-blur-sm" onClick={() => setFullscreen(false)} />}
            <div
                ref={containerRef}
                className={`rounded-[10px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3.5 ${fullscreen ? "fixed inset-4 z-50 flex flex-col" : ""
                    }`}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-3 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <h3 className="text-[14px] font-semibold text-[#f7f8f8]">Workload Topology</h3>
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#3fb950]/10 border border-[#3fb950]/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] wi-live-dot" style={{ boxShadow: "0 0 6px #3fb950" }} />
                            <span className="text-[10px] text-[#3fb950] font-semibold">Live</span>
                        </div>
                        <Dropdown
                            label="Auto-layout"
                            value={layout}
                            options={[
                                { value: "auto", label: "Auto-layout" },
                                { value: "horizontal", label: "Horizontal" },
                                { value: "vertical", label: "Vertical" },
                            ]}
                            onChange={v => setLayout(v as any)}
                            width={150}
                        />
                    </div>
                    <div className="relative" data-topo-menu>
                        <button
                            onClick={() => setMenuOpen(o => !o)}
                            className="w-7 h-7 rounded-md bg-[rgba(15,23,42,0.10)] border border-[rgba(15,23,42,0.14)] flex items-center justify-center text-[#64748b] hover:text-[#f7f8f8] transition-colors"
                        >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                <circle cx="3" cy="8" r="1.5" />
                                <circle cx="8" cy="8" r="1.5" />
                                <circle cx="13" cy="8" r="1.5" />
                            </svg>
                        </button>
                        {menuOpen && (
                            <div className="absolute top-full mt-1 right-0 z-30 w-44 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] shadow-[0_8px_24px_rgba(0,0,0,0.5)] py-1">
                                <MenuItem onClick={() => { reset(); setMenuOpen(false); }}>Reset view</MenuItem>
                                <MenuItem onClick={() => { setFullscreen(f => !f); setMenuOpen(false); }}>
                                    {fullscreen ? "Exit fullscreen" : "Fullscreen"}
                                </MenuItem>
                                <MenuItem onClick={() => { setLocked(l => !l); setMenuOpen(false); }}>
                                    {locked ? "Unlock view" : "Lock view"}
                                </MenuItem>
                                <div className="border-t border-[rgba(15,23,42,0.10)] my-1" />
                                <MenuItem onClick={() => setMenuOpen(false)}>Export as PNG</MenuItem>
                                <MenuItem onClick={() => setMenuOpen(false)}>Refresh data</MenuItem>
                            </div>
                        )}
                    </div>
                </div>

                {/* Canvas */}
                <div
                    className={`relative w-full rounded-lg overflow-hidden select-none ${fullscreen ? "flex-1" : "h-[480px]"
                        } ${locked ? "cursor-default" : dragState.current?.active ? "cursor-grabbing" : "cursor-grab"}`}
                    style={{
                        background: `
                            radial-gradient(ellipse 60% 50% at 30% 40%, rgba(124, 58, 237, 0.18) 0%, transparent 60%),
                            radial-gradient(ellipse 50% 40% at 75% 60%, rgba(59, 130, 246, 0.12) 0%, transparent 55%),
                            radial-gradient(ellipse 40% 30% at 80% 20%, rgba(236, 72, 153, 0.08) 0%, transparent 50%),
                            linear-gradient(135deg, #0f1011 0%, #191a1b 50%, #0f1011 100%)
                        `,
                    }}
                    onWheel={handleWheel}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                >
                    <Starfield />

                    {/* Empty state — shown when no workload data is available */}
                    {layoutNodes.length === 0 && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 pointer-events-none">
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(113,112,255,0.12)", boxShadow: "inset 0 0 0 1px rgba(113,112,255,0.25)" }}>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7170ff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" /><circle cx="19" cy="5" r="2" /><path d="M12 9V5m0 7-5 5m5-5 5 5" /></svg>
                            </div>
                            <p className="text-[13px] font-semibold text-[#f7f8f8]">No workloads detected yet</p>
                            <p className="text-[11px] text-[#8a8f98]">Connect a cluster to visualize workload topology</p>
                        </div>
                    )}

                    {/* Legend */}
                    <div className="absolute top-3 left-3 z-20 px-3 py-2.5 rounded-md bg-[rgba(255,255,255,0.02)]/80 border border-[rgba(15,23,42,0.10)] backdrop-blur-sm">
                        <p className="text-[11px] text-[#f7f8f8] font-semibold mb-1.5">Traffic Flow</p>
                        <div className="space-y-1">
                            <LegendLine color="#ec4899" label="High ( >1k RPS )" />
                            <LegendLine color="#fb923c" label="Medium (100-1k)" />
                            <LegendLine color="#22d3ee" label="Low ( <100)" />
                            <LegendLine color="#475569" label="Idle" dashed />
                        </div>
                    </div>

                    {/* View by */}
                    <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1">
                        <span className="text-[10px] text-[#94a3b8] mr-1.5 font-medium">View by</span>
                        <ViewByButton active={viewMode === "graph"} onClick={() => setViewMode("graph")} title="Graph view">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="5" r="2" />
                                <circle cx="5" cy="19" r="2" />
                                <circle cx="19" cy="19" r="2" />
                                <line x1="12" y1="7" x2="12" y2="13" />
                                <line x1="12" y1="13" x2="5" y2="17" />
                                <line x1="12" y1="13" x2="19" y2="17" />
                            </svg>
                        </ViewByButton>
                        <ViewByButton active={viewMode === "radial"} onClick={() => setViewMode("radial")} title="Radial view">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <circle cx="12" cy="12" r="4" />
                            </svg>
                        </ViewByButton>
                        <ViewByButton active={viewMode === "grid"} onClick={() => setViewMode("grid")} title="Grid view">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="7" height="7" />
                                <rect x="14" y="3" width="7" height="7" />
                                <rect x="3" y="14" width="7" height="7" />
                                <rect x="14" y="14" width="7" height="7" />
                            </svg>
                        </ViewByButton>
                    </div>

                    {/* Right zoom/control buttons */}
                    <div className="absolute top-1/2 -translate-y-1/2 right-3 z-20 flex flex-col gap-1.5">
                        <ControlButton onClick={() => setZoom(z => clamp(z + 0.1, 0.5, 2.5))} disabled={locked} title="Zoom in">+</ControlButton>
                        <ControlButton onClick={() => setZoom(z => clamp(z - 0.1, 0.5, 2.5))} disabled={locked} title="Zoom out">−</ControlButton>
                        <ControlButton onClick={() => setFullscreen(f => !f)} title={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
                            {fullscreen ? (
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="4 14 10 14 10 20" />
                                    <polyline points="20 10 14 10 14 4" />
                                    <line x1="14" y1="10" x2="21" y2="3" />
                                    <line x1="3" y1="21" x2="10" y2="14" />
                                </svg>
                            ) : (
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="15 3 21 3 21 9" />
                                    <polyline points="9 21 3 21 3 15" />
                                    <line x1="21" y1="3" x2="14" y2="10" />
                                    <line x1="3" y1="21" x2="10" y2="14" />
                                </svg>
                            )}
                        </ControlButton>
                        <ControlButton onClick={() => setLocked(l => !l)} title={locked ? "Unlock pan/zoom" : "Lock pan/zoom"} active={locked}>
                            {locked ? (
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                            ) : (
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" />
                                    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                                </svg>
                            )}
                        </ControlButton>
                    </div>

                    {/* Zoom indicator */}
                    {(zoom !== 1 || pan.x !== 0 || pan.y !== 0) && (
                        <button
                            onClick={reset}
                            className="absolute top-3 right-14 z-20 px-2 py-1 rounded-md bg-[rgba(255,255,255,0.02)]/85 border border-[rgba(15,23,42,0.14)] text-[10px] text-[#64748b] hover:text-[#f7f8f8] hover:border-[rgba(15,23,42,0.20)] transition-colors backdrop-blur-sm font-mono"
                        >
                            {Math.round(zoom * 100)}% · Reset
                        </button>
                    )}

                    {/* SVG Topology */}
                    <svg viewBox="0 0 880 480" className="w-full h-full relative z-10" preserveAspectRatio="xMidYMid meet">
                        <defs>
                            {[
                                { name: "pink", color: "#ec4899" }, { name: "rose", color: "#f43f5e" },
                                { name: "orange", color: "#fb923c" }, { name: "amber", color: "#f59e0b" },
                                { name: "cyan", color: "#22d3ee" }, { name: "teal", color: "#06b6d4" },
                                { name: "green", color: "#3fb950" }, { name: "red", color: "#f85149" },
                                { name: "purple", color: "#a371f7" }, { name: "blue", color: "#7170ff" },
                            ].map(({ name }) => (
                                <filter key={name} id={`neon-${name}`} x="-50%" y="-50%" width="200%" height="200%">
                                    <feGaussianBlur stdDeviation="2.5" result="b" />
                                    <feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                                </filter>
                            ))}
                            {[
                                { name: "node-purple", color: "#a371f7" }, { name: "node-green", color: "#3fb950" },
                                { name: "node-orange", color: "#f0883e" }, { name: "node-red", color: "#f85149" },
                                { name: "node-blue", color: "#7170ff" },
                            ].map(({ name, color }) => (
                                <filter key={name} id={name} x="-100%" y="-100%" width="300%" height="300%">
                                    <feGaussianBlur stdDeviation="4" result="blur" />
                                    <feFlood floodColor={color} floodOpacity="0.7" />
                                    <feComposite in2="blur" operator="in" />
                                    <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
                                </filter>
                            ))}
                        </defs>

                        <g style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "440px 240px", transition: dragState.current?.active ? "none" : "transform 0.2s ease" }}>
                            {/* Edges */}
                            {topoEdges.map((edge, i) => {
                                const from = layoutNodes.find(n => n.id === edge.from);
                                const to = layoutNodes.find(n => n.id === edge.to);
                                if (!from || !to) return null;

                                const baseStyle = TRAFFIC_STYLE[edge.traffic];
                                const lineColor = edge.color || baseStyle.color;
                                const isHL = hovered === edge.from || hovered === edge.to;
                                const dimmed = hovered && !isHL;
                                const opacity = edge.traffic === "idle" ? 0.4 : (dimmed ? 0.15 : 1);

                                const dx = to.x - from.x;
                                const dy = to.y - from.y;
                                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                                const ux = dx / len, uy = dy / len;
                                const startX = from.x + ux * 26;
                                const startY = from.y + uy * 26;
                                const endX = to.x - ux * 26;
                                const endY = to.y - uy * 26;
                                const cp1x = startX + dx * 0.3;
                                const cp2x = endX - dx * 0.3;
                                const path = `M${startX},${startY} C${cp1x},${startY} ${cp2x},${endY} ${endX},${endY}`;

                                const filterName = lineColor === "#ec4899" ? "pink"
                                    : lineColor === "#f43f5e" ? "rose"
                                        : lineColor === "#fb923c" ? "orange"
                                            : lineColor === "#f59e0b" ? "amber"
                                                : lineColor === "#22d3ee" ? "cyan"
                                                    : lineColor === "#06b6d4" ? "teal" : "purple";

                                return (
                                    <g key={`edge-${i}`} style={{ opacity }}>
                                        {edge.traffic !== "idle" && (
                                            <path d={path} fill="none" stroke={lineColor} strokeWidth={baseStyle.width + 5} strokeOpacity={0.25} strokeLinecap="round" filter={`url(#neon-${filterName})`} />
                                        )}
                                        {edge.traffic !== "idle" && (
                                            <path d={path} fill="none" stroke={lineColor} strokeWidth={baseStyle.width + 2} strokeOpacity={0.45} strokeLinecap="round" />
                                        )}
                                        <path d={path} fill="none" stroke={lineColor} strokeWidth={baseStyle.width} strokeOpacity={edge.traffic === "idle" ? 1 : 0.95} strokeLinecap="round" strokeDasharray={edge.traffic === "idle" ? "5 5" : undefined} className={baseStyle.class} />
                                        {edge.traffic === "high" && (
                                            <circle r="2.5" fill="#fff" opacity="0.95">
                                                <animateMotion dur="1.4s" repeatCount="indefinite" path={path} />
                                            </circle>
                                        )}
                                    </g>
                                );
                            })}

                            {/* Nodes */}
                            {layoutNodes.map((node) => (
                                <g
                                    key={node.id}
                                    data-node
                                    className="cursor-pointer"
                                    onMouseEnter={() => setHovered(node.id)}
                                    onMouseLeave={() => setHovered(null)}
                                >
                                    <NodeHexagon node={node} highlighted={hovered === node.id} />
                                </g>
                            ))}
                        </g>
                    </svg>
                </div>
            </div>
        </>
    );
}

function clamp(v: number, min: number, max: number) { return Math.min(Math.max(v, min), max); }

// ─── Node Hexagon ────────────────────────────────────────────────────────────

function NodeHexagon({ node, highlighted }: { node: TopoNode & { x: number; y: number }; highlighted: boolean }) {
    const r = 26;
    const hexPoints = Array.from({ length: 6 }, (_, i) => {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        return `${node.x + r * Math.cos(angle)},${node.y + r * Math.sin(angle)}`;
    }).join(" ");
    const innerHexPoints = Array.from({ length: 6 }, (_, i) => {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        return `${node.x + (r - 5) * Math.cos(angle)},${node.y + (r - 5) * Math.sin(angle)}`;
    }).join(" ");

    const filterName = node.color === "#a371f7" ? "node-purple"
        : node.color === "#3fb950" ? "node-green"
            : node.color === "#f0883e" ? "node-orange"
                : node.color === "#f85149" ? "node-red" : "node-blue";

    return (
        <g style={{ transform: highlighted ? "scale(1.1)" : "scale(1)", transformOrigin: `${node.x}px ${node.y}px`, transition: "transform 0.2s ease" }}>
            <polygon points={hexPoints} fill={node.color} fillOpacity="0.08" stroke={node.color} strokeWidth="0.5" strokeOpacity="0.3" filter={`url(#${filterName})`} transform="scale(1.3)" style={{ transformOrigin: `${node.x}px ${node.y}px` }} />
            <polygon points={hexPoints} fill="#191a1b" stroke={node.color} strokeWidth={highlighted ? 2.2 : 1.8} strokeOpacity="0.95" filter={`url(#${filterName})`} />
            <polygon points={innerHexPoints} fill="none" stroke={node.color} strokeWidth="0.5" strokeOpacity="0.35" />
            <g transform={`translate(${node.x}, ${node.y})`}>
                <CubeGlow color={node.color} />
            </g>
            <text x={node.x} y={node.y + r + 16} textAnchor="middle" fontSize="12" fontWeight="600" fill="#f7f8f8" fontFamily="var(--font-sans)">{node.label}</text>
            <text x={node.x} y={node.y + r + 30} textAnchor="middle" fontSize="10" fill="#64748b" fontFamily="var(--font-mono)">{node.sublabel}</text>
        </g>
    );
}

function CubeGlow({ color }: { color: string }) {
    return (
        <g style={{ filter: `drop-shadow(0 0 4px ${color}) drop-shadow(0 0 8px ${color})` }}>
            <path d="M0,-9 L9,-4.5 L0,0 L-9,-4.5 Z" fill={color} fillOpacity="0.55" stroke={color} strokeWidth="1" strokeLinejoin="round" />
            <path d="M-9,-4.5 L0,0 L0,9 L-9,4.5 Z" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1" strokeLinejoin="round" />
            <path d="M9,-4.5 L0,0 L0,9 L9,4.5 Z" fill={color} fillOpacity="0.35" stroke={color} strokeWidth="1" strokeLinejoin="round" />
        </g>
    );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function LegendLine({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
    return (
        <div className="flex items-center gap-2">
            <svg width="22" height="3">
                <line x1="0" y1="1.5" x2="22" y2="1.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeDasharray={dashed ? "4 3" : undefined} style={{ filter: !dashed ? `drop-shadow(0 0 2px ${color})` : undefined }} />
            </svg>
            <span className="text-[10px] text-[#64748b]">{label}</span>
        </div>
    );
}

function ViewByButton({ children, active, onClick, title }: { children: React.ReactNode; active?: boolean; onClick?: () => void; title?: string }) {
    return (
        <button
            onClick={onClick}
            title={title}
            className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${active
                ? "bg-[#7170ff]/20 border border-[#7170ff]/50 text-[#7170ff]"
                : "bg-[rgba(255,255,255,0.02)]/80 border border-[rgba(15,23,42,0.14)] text-[#94a3b8] hover:text-[#f7f8f8] hover:border-[rgba(15,23,42,0.20)]"
                }`}
        >{children}</button>
    );
}

function ControlButton({ children, onClick, disabled, active, title }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; active?: boolean; title?: string }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={`w-7 h-7 rounded-md border flex items-center justify-center transition-colors text-[14px] font-light backdrop-blur-sm ${disabled
                ? "bg-[rgba(255,255,255,0.02)]/40 border-[rgba(15,23,42,0.10)] text-[rgba(15,23,42,0.20)] cursor-not-allowed"
                : active
                    ? "bg-[#7170ff]/20 border-[#7170ff]/50 text-[#7170ff]"
                    : "bg-[rgba(255,255,255,0.02)]/85 border-[rgba(15,23,42,0.14)] text-[#64748b] hover:text-[#f7f8f8] hover:border-[rgba(15,23,42,0.20)]"
                }`}
        >{children}</button>
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
    const stars = Array.from({ length: 90 }, (_, i) => {
        const seed1 = (i * 9301 + 49297) % 233280 / 233280;
        const seed2 = (i * 1103 + 12345) % 65536 / 65536;
        const seed3 = (i * 8121 + 28411) % 134456 / 134456;
        return { x: seed1 * 100, y: seed2 * 100, size: seed3 * 1.4 + 0.4, opacity: seed3 * 0.6 + 0.2, delay: seed1 * 3 };
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
            <div className="absolute top-[15%] left-[35%] w-[180px] h-[180px] rounded-full bg-purple-500/10 blur-[60px]" />
            <div className="absolute bottom-[20%] right-[30%] w-[140px] h-[140px] rounded-full bg-blue-500/10 blur-[50px]" />
            <div className="absolute top-[55%] left-[20%] w-[120px] h-[120px] rounded-full bg-pink-500/8 blur-[55px]" />
        </div>
    );
}
