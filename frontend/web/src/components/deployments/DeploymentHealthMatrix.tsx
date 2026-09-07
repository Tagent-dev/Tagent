"use client";

import { useEffect, useState } from "react";
import { getDeployments, DeploymentInfo } from "@/lib/api";

// ─── Deployment Health Matrix ────────────────────────────────────────────────

interface Deployment {
    name: string;
    env: string;
    namespace: string;
    healthScore: number;
    replicas: string;
    version: string;
    age: string;
    cpu: number;
    memory: number;
    restartTrend: "stable" | "rising" | "falling";
}

function mapDeploymentInfo(d: DeploymentInfo): Deployment {
    const healthScore = d.replicas > 0 ? Math.round((d.ready / d.replicas) * 100) : 0;
    return {
        name: d.name,
        env: "prod",
        namespace: d.namespace,
        healthScore,
        replicas: `${d.ready}/${d.replicas}`,
        version: "—",
        age: d.age,
        cpu: 0,
        memory: 0,
        restartTrend: "stable",
    };
}

export function DeploymentHealthMatrix() {
    const [deployments, setDeployments] = useState<Deployment[] | null>(null);
    const [namespace, setNamespace] = useState("all");
    const [nsOpen, setNsOpen] = useState(false);
    const [view, setView] = useState<"grid" | "list">("grid");
    const [filterOpen, setFilterOpen] = useState(false);
    const [healthFilter, setHealthFilter] = useState<"all" | "healthy" | "degraded" | "critical">("all");
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        function fetchData() {
            getDeployments()
                .then((data) => setDeployments(data.map(mapDeploymentInfo)))
                .catch(() => setDeployments([]));
        }
        fetchData();
        const interval = setInterval(fetchData, 15000);
        return () => clearInterval(interval);
    }, []);

    const data = deployments ?? [];
    const namespaces = ["all", ...Array.from(new Set(data.map(d => d.namespace)))];

    const filtered = data.filter(d => {
        if (namespace !== "all" && d.namespace !== namespace) return false;
        if (healthFilter === "healthy" && d.healthScore < 90) return false;
        if (healthFilter === "degraded" && (d.healthScore >= 90 || d.healthScore < 60)) return false;
        if (healthFilter === "critical" && d.healthScore >= 60) return false;
        return true;
    });

    return (
        <div className="rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3.5">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                    <h3 className="text-[14px] font-semibold text-[#f7f8f8]">Deployment Health Matrix</h3>
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#3fb950]/10 border border-[#3fb950]/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950]" style={{ boxShadow: "0 0 6px #3fb950", animation: "wi-pulse 2s infinite" }} />
                        <span className="text-[10px] text-[#3fb950] font-semibold">Live</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Namespace dropdown */}
                    <div className="relative">
                        <button onClick={() => { setNsOpen(o => !o); setFilterOpen(false); setMenuOpen(false); }} className="flex items-center gap-1 h-7 px-2.5 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] text-[11px] text-[#64748b] hover:text-[#f7f8f8] hover:border-[rgba(15,23,42,0.20)] transition-colors">
                            {namespace === "all" ? "All Namespaces" : namespace}
                            <svg width="9" height="9" viewBox="0 0 12 12" fill="none" className={`transition-transform ${nsOpen ? "rotate-180" : ""}`}><path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </button>
                        {nsOpen && (
                            <div className="absolute top-full mt-1 right-0 z-30 w-40 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] shadow-[0_8px_24px_rgba(0,0,0,0.5)] py-1">
                                {namespaces.map(ns => (
                                    <button key={ns} onClick={() => { setNamespace(ns); setNsOpen(false); }} className={`w-full text-left px-3 py-1.5 text-[11.5px] hover:bg-[rgba(15,23,42,0.10)] ${namespace === ns ? "text-[#7170ff]" : "text-[#f7f8f8]"}`}>{ns === "all" ? "All Namespaces" : ns}</button>
                                ))}
                            </div>
                        )}
                    </div>
                    {/* Grid/List toggle */}
                    <button onClick={() => setView(v => v === "grid" ? "list" : "grid")} title={view === "grid" ? "Switch to list" : "Switch to grid"} className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${view === "grid" ? "bg-[#7170ff]/20 border border-[#7170ff]/50 text-[#7170ff]" : "bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] text-[#64748b] hover:text-[#f7f8f8]"}`}>
                        {view === "grid" ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="4" height="4" rx="1" /><rect x="10" y="3" width="4" height="4" rx="1" /><rect x="17" y="3" width="4" height="4" rx="1" /><rect x="3" y="10" width="4" height="4" rx="1" /><rect x="10" y="10" width="4" height="4" rx="1" /><rect x="17" y="10" width="4" height="4" rx="1" /><rect x="3" y="17" width="4" height="4" rx="1" /><rect x="10" y="17" width="4" height="4" rx="1" /><rect x="17" y="17" width="4" height="4" rx="1" /></svg>
                        ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
                        )}
                    </button>
                    {/* Filter */}
                    <div className="relative">
                        <button onClick={() => { setFilterOpen(o => !o); setNsOpen(false); setMenuOpen(false); }} title="Filter by health" className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${healthFilter !== "all" ? "bg-[#7170ff]/20 border border-[#7170ff]/50 text-[#7170ff]" : "bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] text-[#64748b] hover:text-[#f7f8f8]"}`}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
                        </button>
                        {filterOpen && (
                            <div className="absolute top-full mt-1 right-0 z-30 w-36 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] shadow-[0_8px_24px_rgba(0,0,0,0.5)] py-1">
                                {(["all", "healthy", "degraded", "critical"] as const).map(f => (
                                    <button key={f} onClick={() => { setHealthFilter(f); setFilterOpen(false); }} className={`w-full text-left px-3 py-1.5 text-[11.5px] capitalize hover:bg-[rgba(15,23,42,0.10)] ${healthFilter === f ? "text-[#7170ff]" : "text-[#f7f8f8]"}`}>{f === "all" ? "All Health" : f}</button>
                                ))}
                            </div>
                        )}
                    </div>
                    {/* Menu */}
                    <div className="relative">
                        <button onClick={() => { setMenuOpen(o => !o); setNsOpen(false); setFilterOpen(false); }} className="w-7 h-7 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] flex items-center justify-center text-[#64748b] hover:text-[#f7f8f8] hover:border-[rgba(15,23,42,0.20)] transition-colors">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="3" cy="8" r="1.5" /><circle cx="8" cy="8" r="1.5" /><circle cx="13" cy="8" r="1.5" /></svg>
                        </button>
                        {menuOpen && (
                            <div className="absolute top-full mt-1 right-0 z-30 w-40 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] shadow-[0_8px_24px_rgba(0,0,0,0.5)] py-1">
                                <button onClick={() => setMenuOpen(false)} className="w-full text-left px-3 py-1.5 text-[11.5px] text-[#f7f8f8] hover:bg-[rgba(15,23,42,0.10)]">Refresh data</button>
                                <button onClick={() => setMenuOpen(false)} className="w-full text-left px-3 py-1.5 text-[11.5px] text-[#f7f8f8] hover:bg-[rgba(15,23,42,0.10)]">Export as JSON</button>
                                <button onClick={() => { setNamespace("all"); setHealthFilter("all"); setMenuOpen(false); }} className="w-full text-left px-3 py-1.5 text-[11.5px] text-[#f7f8f8] hover:bg-[rgba(15,23,42,0.10)]">Reset filters</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <p className="text-[10.5px] text-[#64748b] mb-3">Real-time health, performance, and status of all deployments</p>

            {deployments === null && (
                <div className="py-8 text-center">
                    <p className="text-[12px] text-[#64748b]">—</p>
                </div>
            )}

            {deployments !== null && filtered.length === 0 && (
                <div className="py-8 text-center">
                    <p className="text-[12px] text-[#64748b]">No deployments match filters.</p>
                    <button onClick={() => { setNamespace("all"); setHealthFilter("all"); }} className="mt-2 text-[11px] text-[#7170ff]">Clear filters</button>
                </div>
            )}

            {deployments !== null && filtered.length > 0 && view === "grid" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
                    {filtered.map((d, i) => <DeploymentCard key={i} deployment={d} />)}
                </div>
            )}

            {deployments !== null && filtered.length > 0 && view === "list" && (
                <div className="space-y-1.5">
                    {filtered.map((d, i) => <DeploymentListRow key={i} deployment={d} />)}
                </div>
            )}
        </div>
    );
}

// ─── Grid Card ───────────────────────────────────────────────────────────────

function DeploymentCard({ deployment: d }: { deployment: Deployment }) {
    const scoreColor = d.healthScore >= 90 ? "#3fb950" : d.healthScore >= 70 ? "#f0883e" : "#f85149";
    const r = 22;
    const c = 2 * Math.PI * r;
    const offset = c - (d.healthScore / 100) * c;

    return (
        <div className="rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] p-2.5 hover:border-[rgba(15,23,42,0.14)] transition-colors">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: scoreColor, boxShadow: `0 0 4px ${scoreColor}` }} />
                    <span className="text-[11px] font-semibold text-[#f7f8f8] truncate">{d.name}</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(15,23,42,0.10)] text-[#64748b] font-mono">{d.env}</span>
            </div>
            <div className="flex items-center gap-3 mb-2">
                <div className="relative shrink-0">
                    <svg width="50" height="50" viewBox="0 0 50 50">
                        <circle cx="25" cy="25" r={r} fill="none" stroke="rgba(15,23,42,0.10)" strokeWidth="3.5" />
                        <circle cx="25" cy="25" r={r} fill="none" stroke={scoreColor} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 25 25)" style={{ filter: `drop-shadow(0 0 3px ${scoreColor})` }} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[13px] font-bold font-mono" style={{ color: scoreColor }}>{d.healthScore}</span>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-x-2 gap-y-0.5 text-[9px] flex-1">
                    <span className="text-[#64748b]">Replicas</span><span className="text-[#64748b]">Version</span><span className="text-[#64748b]">Age</span>
                    <span className="text-[#f7f8f8] font-mono font-semibold">{d.replicas}</span>
                    <span className="text-[#f7f8f8] font-mono font-semibold">{d.version}</span>
                    <span className="text-[#f7f8f8] font-mono font-semibold">{d.age}</span>
                </div>
            </div>
            <div className="grid grid-cols-3 gap-1 text-center">
                <div><p className="text-[10px] text-[#64748b]">CPU</p><p className="text-[11px] font-bold text-[#f7f8f8] font-mono">{d.cpu}%</p></div>
                <div><p className="text-[10px] text-[#64748b]">Memory</p><p className="text-[11px] font-bold text-[#f7f8f8] font-mono">{d.memory}%</p></div>
                <div><p className="text-[10px] text-[#64748b]">Restart</p><p className="text-[11px] font-bold font-mono" style={{ color: d.restartTrend === "stable" ? "#3fb950" : "#f0883e" }}>{d.restartTrend === "stable" ? "→" : "↗"}</p></div>
            </div>
        </div>
    );
}

// ─── List Row ────────────────────────────────────────────────────────────────

function DeploymentListRow({ deployment: d }: { deployment: Deployment }) {
    const scoreColor = d.healthScore >= 90 ? "#3fb950" : d.healthScore >= 70 ? "#f0883e" : "#f85149";
    return (
        <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] hover:border-[rgba(15,23,42,0.14)] transition-colors">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: scoreColor, boxShadow: `0 0 4px ${scoreColor}` }} />
            <span className="text-[11.5px] font-semibold text-[#f7f8f8] w-[160px] truncate">{d.name}</span>
            <span className="text-[10px] text-[#64748b] font-mono w-[60px]">{d.namespace}</span>
            <span className="text-[11px] font-bold font-mono w-[30px]" style={{ color: scoreColor }}>{d.healthScore}</span>
            <span className="text-[10px] text-[#64748b] font-mono w-[40px]">{d.replicas}</span>
            <span className="text-[10px] text-[#64748b] font-mono w-[50px]">{d.version}</span>
            <span className="text-[10px] text-[#64748b] font-mono w-[50px]">CPU {d.cpu}%</span>
            <span className="text-[10px] text-[#64748b] font-mono w-[50px]">MEM {d.memory}%</span>
            <span className="text-[10px] font-mono ml-auto" style={{ color: d.restartTrend === "stable" ? "#3fb950" : "#f0883e" }}>{d.restartTrend}</span>
        </div>
    );
}
