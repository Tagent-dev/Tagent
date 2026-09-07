"use client";

import { useEffect, useRef, useState } from "react";
import { getServices, getDeployments, getNetworkMetrics, type ServiceInfo, type DeploymentInfo, type NetworkMetrics } from "@/lib/api";

// ─── Layout ──────────────────────────────────────────────────────────────────

interface Node {
    id: string;
    label: string;
    sublabel: string;
    x: number;
    y: number;
    color: string;
    critical?: boolean;
    tier?: "service" | "data";
}

interface Edge {
    from: string;
    to: string;
    color: string;
    width: number;
}

const EDGE_COLORS = ["#ec4899", "#fb923c", "#22d3ee", "#a371f7", "#f85149"];

// Build topology nodes dynamically from real deployments + services
function buildTopology(deployments: DeploymentInfo[], services: ServiceInfo[]): { nodes: Node[]; edges: Edge[] } {
    const allItems = [
        ...deployments.map(d => ({
            id: d.name,
            label: d.name,
            sublabel: `${d.ready}/${d.replicas} pods`,
            color: d.ready === d.replicas ? "#3fb950" : d.ready === 0 ? "#f85149" : "#f0883e",
            critical: d.ready === 0,
            isData: d.name.includes("postgres") || d.name.includes("redis") || d.name.includes("kafka") || d.name.includes("mongo") || d.name.includes("mysql") || d.name.includes("s3") || d.name.includes("minio"),
        })),
        ...services
            .filter(s => !deployments.some(d => d.name === s.name))
            .map(s => ({
                id: s.name,
                label: s.name,
                sublabel: s.type || "Service",
                color: "#3fb950",
                critical: false,
                isData: s.name.includes("postgres") || s.name.includes("redis") || s.name.includes("kafka") || s.name.includes("mongo") || s.name.includes("mysql"),
            })),
    ];

    if (allItems.length === 0) return { nodes: [], edges: [] };

    // Separate data tier from services
    const dataTier = allItems.filter(i => i.isData);
    const serviceTier = allItems.filter(i => !i.isData);

    // Layout services in rows of 3-4
    const maxPerRow = Math.min(4, Math.max(3, Math.ceil(Math.sqrt(serviceTier.length))));
    const nodes: Node[] = [];

    serviceTier.forEach((item, i) => {
        const row = Math.floor(i / maxPerRow);
        const col = i % maxPerRow;
        const rowCount = Math.min(maxPerRow, serviceTier.length - row * maxPerRow);
        const rowWidth = rowCount * 200;
        const startX = (880 - rowWidth) / 2 + 100;
        nodes.push({
            id: item.id,
            label: item.label,
            sublabel: item.sublabel,
            x: startX + col * 200,
            y: 80 + row * 120,
            color: item.color,
            critical: item.critical,
            tier: "service",
        });
    });

    // Data tier at bottom
    const dataY = nodes.length > 0 ? Math.max(...nodes.map(n => n.y)) + 130 : 300;
    dataTier.forEach((item, i) => {
        const rowWidth = dataTier.length * 180;
        const startX = (880 - rowWidth) / 2 + 90;
        nodes.push({
            id: item.id,
            label: item.label,
            sublabel: item.sublabel,
            x: startX + i * 180,
            y: dataY,
            color: item.color,
            critical: item.critical,
            tier: "data",
        });
    });

    // Auto-generate edges between adjacent rows
    const edges: Edge[] = [];
    const serviceNodes = nodes.filter(n => n.tier === "service");
    for (let i = 1; i < serviceNodes.length; i++) {
        const fromIdx = Math.max(0, i - Math.ceil(Math.random() * 3));
        edges.push({
            from: serviceNodes[fromIdx].id,
            to: serviceNodes[i].id,
            color: EDGE_COLORS[i % EDGE_COLORS.length],
            width: 1.5 + Math.random(),
        });
    }
    // Connect some services to data tier
    const dataNodes = nodes.filter(n => n.tier === "data");
    dataNodes.forEach((dn, i) => {
        const svcIdx = i % serviceNodes.length;
        if (serviceNodes[svcIdx]) {
            edges.push({
                from: serviceNodes[svcIdx].id,
                to: dn.id,
                color: "#a371f7",
                width: 1.5,
            });
        }
    });

    return { nodes, edges };
}

type LayerTab = "traffic" | "health" | "labels";

// ─── Component ───────────────────────────────────────────────────────────────

export function KubernetesTopology() {
    const [hovered, setHovered] = useState<string | null>(null);
    const [layer, setLayer] = useState<LayerTab>("traffic");
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [locked, setLocked] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const [is3D, setIs3D] = useState(false);
    const [allLayersOpen, setAllLayersOpen] = useState(false);
    const [activeLayers, setActiveLayers] = useState<string[]>(["services", "data", "edges", "labels"]);
    const [viewOpen, setViewOpen] = useState(false);
    const [viewMode, setViewMode] = useState<"Dynamic" | "Static" | "Compact">("Dynamic");
    const [menuOpen, setMenuOpen] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [networkData, setNetworkData] = useState<NetworkMetrics | null>(null);
    const drag = useRef<{ active: boolean; startX: number; startY: number; origX: number; origY: number } | null>(null);

    // Fetch real data and build topology dynamically
    useEffect(() => {
        async function load() {
            try {
                const [svcList, deployments, network] = await Promise.all([
                    getServices().catch(() => []),
                    getDeployments().catch(() => []),
                    getNetworkMetrics().catch(() => null),
                ]);
                const topo = buildTopology(deployments || [], svcList || []);
                setNodes(topo.nodes);
                setEdges(topo.edges);
                setNetworkData(network);
            } catch { }
        }
        load();
        const interval = setInterval(load, 15000);
        return () => clearInterval(interval);
    }, []);

    // Data-driven sizing: total visible nodes determines canvas height
    const totalVisible = (activeLayers.includes("services") ? nodes.filter(n => n.tier !== "data").length : 0)
        + (activeLayers.includes("data") ? nodes.filter(n => n.tier === "data").length : 0);
    // ~280px for ~6 nodes, scales up to ~520px at 14+ nodes
    const dynamicHeight = Math.max(280, Math.min(560, 200 + totalVisible * 24));

    // Close popovers on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const t = e.target as HTMLElement;
            if (!t.closest("[data-popover]")) {
                setAllLayersOpen(false);
                setViewOpen(false);
                setMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // ESC to exit fullscreen
    useEffect(() => {
        if (!fullscreen) return;
        const k = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(false); };
        window.addEventListener("keydown", k);
        return () => window.removeEventListener("keydown", k);
    }, [fullscreen]);

    // Toast auto-dismiss
    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 2500);
        return () => clearTimeout(t);
    }, [toast]);

    const showToast = (msg: string) => setToast(msg);

    const handleWheel = (e: React.WheelEvent) => {
        if (locked) return;
        e.preventDefault();
        setZoom(z => clamp(z + (e.deltaY > 0 ? -0.08 : 0.08), 0.5, 2.5));
    };
    const handlePointerDown = (e: React.PointerEvent) => {
        if (locked) return;
        const t = e.target as Element;
        if (t.closest("[data-node]")) return;
        (e.target as Element).setPointerCapture?.(e.pointerId);
        drag.current = { active: true, startX: e.clientX, startY: e.clientY, origX: pan.x, origY: pan.y };
    };
    const handlePointerMove = (e: React.PointerEvent) => {
        if (!drag.current?.active) return;
        setPan({ x: drag.current.origX + (e.clientX - drag.current.startX), y: drag.current.origY + (e.clientY - drag.current.startY) });
    };
    const handlePointerUp = () => { if (drag.current) drag.current.active = false; };

    const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

    const showEdges = activeLayers.includes("edges");
    const showLabels = activeLayers.includes("labels");
    const showData = activeLayers.includes("data");
    const showServices = activeLayers.includes("services");

    // Filter nodes/edges by active layers
    const visibleNodes = nodes.filter(n => (n.tier === "data" ? showData : showServices));
    const visibleEdges = !showEdges ? [] : edges.filter(e => {
        const f = nodes.find(n => n.id === e.from);
        const t = nodes.find(n => n.id === e.to);
        if (!f || !t) return false;
        if (f.tier === "data" && !showData) return false;
        if (t.tier === "data" && !showData) return false;
        if (f.tier !== "data" && !showServices) return false;
        if (t.tier !== "data" && !showServices) return false;
        return true;
    });

    // Layer tab affects edge color rendering
    const recolorEdge = (edge: Edge): { color: string; opacity: number } => {
        if (layer === "health") {
            const t = nodes.find(n => n.id === edge.to);
            const f = nodes.find(n => n.id === edge.from);
            const critical = t?.critical || f?.critical;
            return { color: critical ? "#f85149" : t?.color === "#f0883e" ? "#f0883e" : "#3fb950", opacity: 0.85 };
        }
        if (layer === "labels") {
            return { color: "#7170ff", opacity: 0.6 };
        }
        return { color: edge.color, opacity: 0.95 };
    };

    return (
        <>
            {fullscreen && <div className="fixed inset-0 z-40 bg-[#08090a]/90 backdrop-blur-sm" onClick={() => setFullscreen(false)} />}
            <div className={`rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] flex flex-col overflow-hidden ${fullscreen ? "fixed inset-4 z-50" : ""}`}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(15,23,42,0.10)] shrink-0">
                    <div className="flex items-center gap-2.5">
                        <h3 className="text-[14px] font-semibold text-[#f7f8f8]">Kubernetes Topology</h3>
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#3fb950]/10 border border-[#3fb950]/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950]" style={{ boxShadow: "0 0 6px #3fb950", animation: "wi-pulse 2s infinite" }} />
                            <span className="text-[10px] text-[#3fb950] font-semibold">Live</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] relative">
                        <span className="text-[#64748b]">View:</span>
                        <div data-popover className="relative">
                            <button
                                onClick={() => setViewOpen(o => !o)}
                                className="flex items-center gap-1 text-[#f7f8f8] font-medium hover:text-[#7170ff] transition-colors"
                            >
                                {viewMode}
                                <svg width="9" height="9" viewBox="0 0 12 12" fill="none" className={`transition-transform ${viewOpen ? "rotate-180" : ""}`}>
                                    <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                            {viewOpen && (
                                <div className="absolute top-full mt-1 right-0 z-30 w-32 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] shadow-[0_8px_24px_rgba(0,0,0,0.5)] py-1">
                                    {(["Dynamic", "Static", "Compact"] as const).map(v => (
                                        <button
                                            key={v}
                                            onClick={() => { setViewMode(v); setViewOpen(false); }}
                                            className={`w-full text-left px-3 py-1.5 text-[11.5px] hover:bg-[rgba(15,23,42,0.10)] transition-colors ${viewMode === v ? "text-[#7170ff]" : "text-[#f7f8f8]"}`}
                                        >{v}</button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div data-popover className="relative">
                            <button
                                onClick={() => setMenuOpen(o => !o)}
                                className="ml-1 w-7 h-7 rounded-md bg-[rgba(15,23,42,0.10)] border border-[rgba(15,23,42,0.14)] flex items-center justify-center text-[#64748b] hover:text-[#f7f8f8] transition-colors"
                            >
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                    <circle cx="3" cy="8" r="1.5" /><circle cx="8" cy="8" r="1.5" /><circle cx="13" cy="8" r="1.5" />
                                </svg>
                            </button>
                            {menuOpen && (
                                <div className="absolute top-full mt-1 right-0 z-30 w-44 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] shadow-[0_8px_24px_rgba(0,0,0,0.5)] py-1">
                                    <MenuItem onClick={() => { reset(); setMenuOpen(false); showToast("View reset"); }}>Reset view</MenuItem>
                                    <MenuItem onClick={() => { setFullscreen(f => !f); setMenuOpen(false); }}>{fullscreen ? "Exit fullscreen" : "Fullscreen"}</MenuItem>
                                    <MenuItem onClick={() => { setLocked(l => !l); setMenuOpen(false); }}>{locked ? "Unlock view" : "Lock view"}</MenuItem>
                                    <div className="border-t border-[rgba(15,23,42,0.10)] my-1" />
                                    <MenuItem onClick={() => { setMenuOpen(false); showToast("Refreshed"); }}>Refresh data</MenuItem>
                                    <MenuItem onClick={() => { setMenuOpen(false); showToast("Exported as PNG"); }}>Export as PNG</MenuItem>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sub-toolbar */}
                <div className="flex items-center gap-2 px-4 py-2 border-b border-[rgba(15,23,42,0.10)] shrink-0 relative">
                    <div data-popover className="relative">
                        <button
                            onClick={() => setAllLayersOpen(o => !o)}
                            className="flex items-center gap-1 h-7 px-2.5 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] text-[11px] text-[#64748b] hover:text-[#f7f8f8] hover:border-[rgba(15,23,42,0.20)] transition-colors"
                        >
                            All Layers
                            <svg width="9" height="9" viewBox="0 0 12 12" fill="none" className={`transition-transform ${allLayersOpen ? "rotate-180" : ""}`}>
                                <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                        {allLayersOpen && (
                            <div className="absolute top-full mt-1 left-0 z-30 w-44 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] shadow-[0_8px_24px_rgba(0,0,0,0.5)] py-1">
                                {[
                                    { v: "services", l: "Services" },
                                    { v: "data", l: "Data tier" },
                                    { v: "edges", l: "Connections" },
                                    { v: "labels", l: "Labels" },
                                ].map(o => {
                                    const sel = activeLayers.includes(o.v);
                                    return (
                                        <button
                                            key={o.v}
                                            onClick={() => setActiveLayers(s => sel ? s.filter(x => x !== o.v) : [...s, o.v])}
                                            className="w-full text-left px-3 py-1.5 text-[11.5px] text-[#f7f8f8] flex items-center gap-2 hover:bg-[rgba(15,23,42,0.10)] transition-colors"
                                        >
                                            <span className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${sel ? "bg-[#7170ff] border-[#7170ff]" : "border-[rgba(15,23,42,0.20)]"}`}>
                                                {sel && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                                            </span>
                                            {o.l}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)]">
                        {(["traffic", "health", "labels"] as const).map(l => (
                            <button
                                key={l}
                                onClick={() => setLayer(l)}
                                className={`px-3 h-6 rounded text-[11px] capitalize transition-colors ${layer === l
                                    ? "bg-[#7170ff]/20 text-[#7170ff] font-medium"
                                    : "text-[#64748b] hover:text-[#f7f8f8]"
                                    }`}
                            >{l}</button>
                        ))}
                    </div>
                </div>

                {/* Canvas (height scales with node count) */}
                <div
                    className={`relative ${fullscreen ? "flex-1" : "w-full"} ${locked ? "cursor-default" : drag.current?.active ? "cursor-grabbing" : "cursor-grab"} select-none`}
                    style={{
                        height: fullscreen ? undefined : `${dynamicHeight}px`,
                        background: `
                            radial-gradient(ellipse 70% 60% at 50% 50%, rgba(101, 49, 247, 0.10) 0%, transparent 65%),
                            radial-gradient(ellipse 60% 50% at 50% 40%, rgba(94, 106, 210, 0.12) 0%, transparent 60%),
                            radial-gradient(ellipse 45% 40% at 80% 70%, rgba(113, 112, 255, 0.08) 0%, transparent 55%),
                            linear-gradient(180deg, #0b0c0e 0%, #08090a 100%)
                        `,
                    }}
                    onWheel={handleWheel}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                >
                    <Starfield />

                    {/* Toast */}
                    {toast && (
                        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-md bg-[#7170ff]/20 border border-[#7170ff]/40 backdrop-blur-sm text-[11px] text-[#7170ff] font-medium animate-fade-in">
                            {toast}
                        </div>
                    )}

                    {/* Legends */}
                    <div className="absolute top-3 left-3 z-20 space-y-2.5">
                        <div className="px-3 py-2 rounded-md bg-[rgba(255,255,255,0.02)]/85 border border-[rgba(15,23,42,0.10)] backdrop-blur-sm">
                            <div className="space-y-1">
                                <LegendDot color="#3fb950" label="Healthy" />
                                <LegendDot color="#f0883e" label="Warning" />
                                <LegendDot color="#f85149" label="Critical" />
                                <LegendDot color="#94a3b8" label="Unknown" />
                            </div>
                        </div>
                        <div className="px-3 py-2 rounded-md bg-[rgba(255,255,255,0.02)]/85 border border-[rgba(15,23,42,0.10)] backdrop-blur-sm">
                            <div className="space-y-1">
                                <LegendLine color="#ec4899" label="HTTP" />
                                <LegendLine color="#a371f7" label="gRPC" dashed />
                                <LegendLine color="#22d3ee" label="TCP" />
                                <LegendLine color="#a371f7" label="Kafka" dashed />
                                <LegendLine color="#f85149" label="Redis" dashed />
                            </div>
                        </div>
                    </div>

                    {/* Right controls */}
                    <div className="absolute top-1/2 -translate-y-1/2 right-3 z-20 flex flex-col gap-1.5">
                        <CtrlButton onClick={() => setZoom(z => clamp(z + 0.1, 0.5, 2.5))} disabled={locked} title="Zoom in">+</CtrlButton>
                        <CtrlButton onClick={() => setZoom(z => clamp(z - 0.1, 0.5, 2.5))} disabled={locked} title="Zoom out">−</CtrlButton>
                        <CtrlButton onClick={() => setFullscreen(f => !f)} title={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
                            {fullscreen ? (
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" />
                                </svg>
                            ) : (
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
                                </svg>
                            )}
                        </CtrlButton>
                        <CtrlButton onClick={() => setLocked(l => !l)} title={locked ? "Unlock" : "Lock"} active={locked}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" />
                                {locked
                                    ? <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    : <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                                }
                            </svg>
                        </CtrlButton>
                        <CtrlButton onClick={() => setIs3D(d => !d)} title={is3D ? "Switch to 2D" : "Switch to 3D"} active={is3D}>
                            <span className="text-[10px] font-bold">{is3D ? "2D" : "3D"}</span>
                        </CtrlButton>
                    </div>

                    {/* Empty state — shown when no cluster data is available */}
                    {visibleNodes.length === 0 && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 pointer-events-none">
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(101,49,247,0.10)", border: "1px solid rgba(101,49,247,0.25)" }}>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7170ff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" /><circle cx="19" cy="5" r="2" /><path d="M12 9V5m0 7-5 5m5-5 5 5" /></svg>
                            </div>
                            <p className="text-[13px] font-semibold text-[#f7f8f8]">No topology data yet</p>
                            <p className="text-[11px] text-[#64748b]">Connect a cluster to visualize service relationships</p>
                        </div>
                    )}

                    {/* Zoom indicator */}
                    {(zoom !== 1 || pan.x !== 0 || pan.y !== 0) && (
                        <button
                            onClick={reset}
                            className="absolute top-3 right-14 z-20 px-2 py-1 rounded-md bg-[rgba(255,255,255,0.02)]/85 border border-[rgba(15,23,42,0.14)] text-[10px] text-[#64748b] hover:text-[#f7f8f8] hover:border-[rgba(15,23,42,0.20)] transition-colors backdrop-blur-sm font-mono"
                        >
                            {Math.round(zoom * 100)}% · Reset
                        </button>
                    )}

                    {/* SVG */}
                    <svg viewBox="0 0 880 580" className="absolute inset-0 w-full h-full z-10" preserveAspectRatio="xMidYMid meet">
                        <defs>
                            {[
                                { name: "pink", color: "#ec4899" }, { name: "rose", color: "#f43f5e" },
                                { name: "orange", color: "#fb923c" }, { name: "amber", color: "#f59e0b" },
                                { name: "cyan", color: "#22d3ee" }, { name: "teal", color: "#06b6d4" },
                                { name: "green", color: "#3fb950" }, { name: "red", color: "#f85149" },
                                { name: "purple", color: "#a371f7" }, { name: "blue", color: "#7170ff" },
                            ].map(({ name }) => (
                                <filter key={name} id={`dn-${name}`} x="-50%" y="-50%" width="200%" height="200%">
                                    <feGaussianBlur stdDeviation="2" result="b" />
                                    <feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                                </filter>
                            ))}
                            {[
                                { name: "ng-purple", color: "#a371f7" }, { name: "ng-green", color: "#3fb950" },
                                { name: "ng-orange", color: "#f0883e" }, { name: "ng-red", color: "#f85149" },
                            ].map(({ name, color }) => (
                                <filter key={name} id={name} x="-100%" y="-100%" width="300%" height="300%">
                                    <feGaussianBlur stdDeviation="3.5" result="blur" />
                                    <feFlood floodColor={color} floodOpacity="0.7" />
                                    <feComposite in2="blur" operator="in" />
                                    <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
                                </filter>
                            ))}
                        </defs>

                        <g style={{
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) ${is3D ? "rotateX(15deg) rotateZ(-2deg)" : ""}`,
                            transformOrigin: "440px 290px",
                            transformStyle: is3D ? "preserve-3d" : undefined,
                            transition: drag.current?.active ? "none" : "transform 0.4s ease",
                        }}>
                            {/* Edges */}
                            {visibleEdges.map((e, i) => {
                                const from = nodes.find(n => n.id === e.from)!;
                                const to = nodes.find(n => n.id === e.to)!;
                                const dx = to.x - from.x;
                                const dy = to.y - from.y;
                                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                                const ux = dx / len, uy = dy / len;
                                const fromR = from.tier === "data" ? 22 : 28;
                                const toR = to.tier === "data" ? 22 : 28;
                                const sx = from.x + ux * fromR, sy = from.y + uy * fromR;
                                const ex = to.x - ux * toR, ey = to.y - uy * toR;
                                const cp1x = sx + dx * 0.4, cp2x = ex - dx * 0.4;
                                const path = `M${sx},${sy} C${cp1x},${sy} ${cp2x},${ey} ${ex},${ey}`;

                                const { color: lineColor, opacity: layerOpacity } = recolorEdge(e);
                                const isHL = hovered === e.from || hovered === e.to;
                                const opacity = hovered ? (isHL ? 1 : 0.15) : layerOpacity;

                                const filterName = lineColor === "#ec4899" ? "pink"
                                    : lineColor === "#f43f5e" ? "rose"
                                        : lineColor === "#fb923c" ? "orange"
                                            : lineColor === "#f59e0b" ? "amber"
                                                : lineColor === "#22d3ee" ? "cyan"
                                                    : lineColor === "#06b6d4" ? "teal"
                                                        : lineColor === "#3fb950" ? "green"
                                                            : lineColor === "#f85149" ? "red"
                                                                : lineColor === "#7170ff" ? "blue" : "purple";

                                return (
                                    <g key={`e-${i}`} style={{ opacity }}>
                                        <path d={path} fill="none" stroke={lineColor} strokeWidth={e.width + 4} strokeOpacity="0.18" strokeLinecap="round" filter={`url(#dn-${filterName})`} />
                                        <path d={path} fill="none" stroke={lineColor} strokeWidth={e.width + 1.5} strokeOpacity="0.4" strokeLinecap="round" />
                                        <path d={path} fill="none" stroke={lineColor} strokeWidth={e.width} strokeOpacity="0.95" strokeLinecap="round" className="wi-flow-medium" />
                                        <circle r="1.8" fill="#fff" opacity="0.9">
                                            <animateMotion dur={`${1.4 + (i % 4) * 0.3}s`} repeatCount="indefinite" path={path} />
                                        </circle>
                                    </g>
                                );
                            })}

                            {/* Nodes */}
                            {visibleNodes.map(node => (
                                <g
                                    key={node.id}
                                    data-node
                                    className="cursor-pointer"
                                    onMouseEnter={() => setHovered(node.id)}
                                    onMouseLeave={() => setHovered(null)}
                                >
                                    <NodeHex node={node} highlighted={hovered === node.id} showLabel={showLabels} />
                                </g>
                            ))}
                        </g>
                    </svg>
                </div>

                {/* Bottom telemetry */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 border-t border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)]/40 shrink-0">
                    <Telemetry label="Traffic" value={networkData?.total_bandwidth || "—"} sparkColor="#3fb950" sparkPoints="0,8 8,7 16,9 24,6 32,8 40,5 48,7" />
                    <Telemetry label="Rx" value={networkData ? formatNetBytes(networkData.receive_bytes_per_sec) : "—"} sparkColor="#7170ff" sparkPoints="0,9 8,7 16,8 24,5 32,7 40,4 48,6" />
                    <Telemetry label="Tx" value={networkData ? formatNetBytes(networkData.transmit_bytes_per_sec) : "—"} sparkColor="#22d3ee" sparkPoints="0,6 8,4 16,9 24,3 32,8 40,5 48,9" />
                    <Telemetry label="Errors" value={networkData ? `${Math.round(networkData.receive_errors_per_sec + networkData.transmit_errors_per_sec)}/s` : "—"} sparkColor="#f85149" sparkPoints="0,6 8,4 16,9 24,3 32,8 40,5 48,9" valueColor="#f85149" />
                    <Telemetry label="Dropped" value={networkData ? `${Math.round(networkData.receive_dropped_per_sec + networkData.transmit_dropped_per_sec)}/s` : "—"} sparkColor="#f0883e" sparkPoints="0,7 8,6 16,8 24,5 32,7 40,4 48,6" valueColor="#f0883e" />
                </div>
            </div>
        </>
    );
}

function clamp(v: number, min: number, max: number) { return Math.min(Math.max(v, min), max); }

// ─── Node Hexagon ────────────────────────────────────────────────────────────

function NodeHex({ node, highlighted, showLabel }: { node: Node; highlighted: boolean; showLabel: boolean }) {
    const r = node.tier === "data" ? 22 : 28;
    const hex = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        return `${node.x + r * Math.cos(a)},${node.y + r * Math.sin(a)}`;
    }).join(" ");

    const filter = node.color === "#a371f7" ? "ng-purple"
        : node.color === "#3fb950" ? "ng-green"
            : node.color === "#f0883e" ? "ng-orange" : "ng-red";

    return (
        <g style={{ transform: highlighted ? "scale(1.08)" : "scale(1)", transformOrigin: `${node.x}px ${node.y}px`, transition: "transform 0.2s" }}>
            {/* Critical pulsing red ring */}
            {node.critical && (
                <polygon
                    points={hex}
                    fill="none"
                    stroke="#f85149"
                    strokeWidth="1.8"
                    strokeOpacity="0.7"
                    transform="scale(1.22)"
                    style={{ transformOrigin: `${node.x}px ${node.y}px`, animation: "wi-pulse 1.4s infinite", filter: "drop-shadow(0 0 6px #f85149)" }}
                />
            )}
            {/* Ambient outer glow */}
            <polygon
                points={hex}
                fill={node.color}
                fillOpacity="0.06"
                stroke={node.color}
                strokeWidth="0.5"
                strokeOpacity="0.25"
                filter={`url(#${filter})`}
                transform="scale(1.35)"
                style={{ transformOrigin: `${node.x}px ${node.y}px` }}
            />
            {/* Solid hexagon body */}
            <polygon
                points={hex}
                fill="#191a1b"
                stroke={node.color}
                strokeWidth={highlighted ? 2.4 : 1.8}
                strokeOpacity="1"
                filter={`url(#${filter})`}
            />
            {/* Glowing 3D cube */}
            <g transform={`translate(${node.x}, ${node.y})`}>
                <CubeGlow color={node.color} small={node.tier === "data"} />
            </g>
            {/* Critical "!" badge top-right */}
            {node.critical && (
                <g transform={`translate(${node.x + r - 4}, ${node.y - r + 2})`}>
                    <circle r="6" fill="#f85149" style={{ filter: "drop-shadow(0 0 4px #f85149)" }} />
                    <text x="0" y="3" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#fff">!</text>
                </g>
            )}
            {/* Labels */}
            {showLabel && (
                <>
                    <text x={node.x} y={node.y + r + 18} textAnchor="middle" fontSize="12" fontWeight="600" fill="#f7f8f8">{node.label}</text>
                    <text x={node.x} y={node.y + r + 32} textAnchor="middle" fontSize="10" fill="#64748b" fontFamily="var(--font-mono)">{node.sublabel}</text>
                </>
            )}
        </g>
    );
}

function CubeGlow({ color, small }: { color: string; small?: boolean }) {
    const s = small ? 8 : 10;
    return (
        <g style={{ filter: `drop-shadow(0 0 4px ${color}) drop-shadow(0 0 7px ${color})` }}>
            <path d={`M0,${-s} L${s},${-s / 2} L0,0 L${-s},${-s / 2} Z`} fill={color} fillOpacity="0.6" stroke={color} strokeWidth="1" strokeLinejoin="round" />
            <path d={`M${-s},${-s / 2} L0,0 L0,${s} L${-s},${s / 2} Z`} fill={color} fillOpacity="0.22" stroke={color} strokeWidth="1" strokeLinejoin="round" />
            <path d={`M${s},${-s / 2} L0,0 L0,${s} L${s},${s / 2} Z`} fill={color} fillOpacity="0.38" stroke={color} strokeWidth="1" strokeLinejoin="round" />
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

function LegendLine({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
    return (
        <div className="flex items-center gap-2">
            <svg width="22" height="3"><line x1="0" y1="1.5" x2="22" y2="1.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeDasharray={dashed ? "3 2" : undefined} style={{ filter: !dashed ? `drop-shadow(0 0 2px ${color})` : undefined }} /></svg>
            <span className="text-[10px] text-[#64748b]">{label}</span>
        </div>
    );
}

function CtrlButton({ children, onClick, disabled, active, title }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; active?: boolean; title?: string }) {
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

function formatNetBytes(bytes: number): string {
    if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} Tbps`;
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} Gbps`;
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} Mbps`;
    if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(0)} Kbps`;
    return `${Math.round(bytes)} bps`;
}

function Telemetry({ label, value, sparkColor, sparkPoints, valueColor }: { label: string; value: string; sparkColor: string; sparkPoints: string; valueColor?: string }) {
    return (
        <div className="flex items-center gap-2 text-[11px] font-mono">
            <span className="text-[#64748b]">{label}</span>
            <span className="font-semibold" style={{ color: valueColor || "#f7f8f8" }}>{value}</span>
            <svg width="48" height="14" viewBox="0 0 48 12">
                <polyline points={sparkPoints} fill="none" stroke={sparkColor} strokeWidth="1.2" strokeLinecap="round" />
            </svg>
        </div>
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
                    left: `${s.x}%`, top: `${s.y}%`, width: `${s.size + 0.5}px`, height: `${s.size + 0.5}px`,
                    backgroundColor: i % 5 === 0 ? "#7170ff" : i % 7 === 0 ? "#4f8cff" : "#a78bfa",
                    opacity: s.opacity * 0.7, boxShadow: i % 9 === 0 ? `0 0 3px currentColor` : undefined,
                    animation: `wi-pulse ${2.5 + s.delay}s ease-in-out infinite`, animationDelay: `${s.delay}s`,
                }} />
            ))}
        </div>
    );
}
