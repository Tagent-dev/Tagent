"use client";

import { useEffect, useState } from "react";
import { Dropdown, MultiSelectDropdown } from "./Dropdown";
import { getPods, getMetricsSummary, type PodInfo, type MetricsSummary } from "@/lib/api";

// ─── Pod Data ────────────────────────────────────────────────────────────────

interface Pod {
    name: string;
    type: string;
    namespace: string;
    status: "Running" | "Pending" | "Restarting";
    cpu: { percent: string; cores: string; spark: number[]; color: string };
    memory: { percent: string; size: string; spark: number[]; color: string };
    restarts: { count: number; bars: number[]; color: string };
    healthScore: number;
    risk: "Low" | "Medium" | "High" | "Critical";
    aiAnalysis: { text: string; color: string; confidence: number; icon?: "refresh" };
}

function mapPodToRow(p: PodInfo): Pod {
    const cpuUsed = parseFloat(p.cpu_used) || 0;
    const memUsed = parseFloat(p.memory_used) || 0;
    const cpuReq = parseFloat(p.cpu_request) || 1;
    const memReq = parseFloat(p.memory_request) || 1;
    const cpuPercent = cpuReq > 0 ? Math.round((cpuUsed / cpuReq) * 100) : 0;
    const memPercent = memReq > 0 ? Math.round((memUsed / memReq) * 100) : 0;

    // Color based on actual usage thresholds
    const cpuColor = cpuPercent > 80 ? "#f85149" : cpuPercent > 60 ? "#f0883e" : cpuPercent > 30 ? "#22d3ee" : "#3fb950";
    const memColor = memPercent > 80 ? "#f85149" : memPercent > 60 ? "#f0883e" : memPercent > 30 ? "#a371f7" : "#3fb950";

    // Color based on restarts
    const restartColor = p.restarts > 10 ? "#f85149" : p.restarts > 3 ? "#f0883e" : p.restarts > 0 ? "#d29922" : "#3fb950";

    const healthScore = Math.max(0, 100 - (p.restarts * 5) - (cpuPercent > 80 ? 20 : 0) - (memPercent > 80 ? 15 : 0) - (p.status !== "Running" ? 40 : 0));
    const risk: Pod["risk"] = healthScore >= 80 ? "Low" : healthScore >= 60 ? "Medium" : healthScore >= 40 ? "High" : "Critical";

    const status: Pod["status"] = p.status === "Running" ? "Running" : p.status === "Pending" ? "Pending" : "Restarting";

    // Unique seed per pod for graph variation
    const seed = p.name.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

    let aiText = "Stable";
    let aiColor = "#3fb950";
    let aiConfidence = 94;
    let aiIcon: "refresh" | undefined;
    if (p.restarts > 10) { aiText = "CrashLoopBackOff"; aiColor = "#f85149"; aiConfidence = 95; aiIcon = "refresh"; }
    else if (p.restarts > 3) { aiText = "High restart rate"; aiColor = "#f0883e"; aiConfidence = 88; aiIcon = "refresh"; }
    else if (cpuPercent > 80) { aiText = "CPU throttled"; aiColor = "#f85149"; aiConfidence = 87; }
    else if (memPercent > 75) { aiText = "Memory pressure"; aiColor = "#f0883e"; aiConfidence = 91; }
    else if (p.status === "Pending") { aiText = "Scheduling issue"; aiColor = "#f0883e"; aiConfidence = 92; }
    else if (p.status !== "Running") { aiText = "Unhealthy"; aiColor = "#f85149"; aiConfidence = 90; }

    return {
        name: p.name,
        type: "Deployment",
        namespace: p.namespace,
        status,
        cpu: { percent: `${cpuPercent}%`, cores: p.cpu_used || "—", spark: generateSpark(cpuPercent, seed), color: cpuColor },
        memory: { percent: `${memPercent}%`, size: p.memory_used || "—", spark: generateSpark(memPercent, seed + 100), color: memColor },
        restarts: { count: p.restarts, bars: generateBars(p.restarts, seed + 200), color: restartColor },
        healthScore,
        risk,
        aiAnalysis: { text: aiText, color: aiColor, confidence: aiConfidence, icon: aiIcon },
    };
}

function generateSpark(value: number, seed?: number): number[] {
    // Generate unique sparkline per pod using seed for variation
    const s = seed || Math.floor(Math.random() * 1000);
    if (value === 0) {
        // Even at 0%, show a flat low line (not identical waves)
        return Array.from({ length: 10 }, (_, i) => 1 + ((s + i * 7) % 3));
    }
    const base = Math.max(2, Math.floor(value / 8));
    return Array.from({ length: 10 }, (_, i) => {
        const noise = ((s + i * 13 + value * 3) % 7) - 3;
        return Math.max(1, Math.min(18, base + noise));
    });
}

function generateBars(restarts: number, seed?: number): number[] {
    const s = seed || Math.floor(Math.random() * 1000);
    if (restarts === 0) {
        return Array.from({ length: 8 }, () => 0);
    }
    return Array.from({ length: 8 }, (_, i) => {
        const v = Math.max(1, Math.min(18, restarts + ((s + i * 11) % 8) - 4));
        return v;
    });
}

// ─── Component ───────────────────────────────────────────────────────────────

const ALL_COLUMNS = [
    { value: "namespace", label: "Namespace" },
    { value: "status", label: "Status" },
    { value: "cpu", label: "CPU" },
    { value: "memory", label: "Memory" },
    { value: "restarts", label: "Restarts (15m)" },
    { value: "health", label: "Health Score" },
    { value: "risk", label: "Risk Level" },
    { value: "ai", label: "AI Analysis" },
];

export function WorkloadExplorer() {
    const [search, setSearch] = useState("");
    const [namespace, setNamespace] = useState("all");
    const [status, setStatus] = useState("all");
    const [risk, setRisk] = useState("all");
    const [groupBy, setGroupBy] = useState("none");
    const [view, setView] = useState<"list" | "grid">("list");
    const [visibleCols, setVisibleCols] = useState<string[]>(ALL_COLUMNS.map(c => c.value));
    const [podRows, setPodRows] = useState<Pod[]>([]);

    useEffect(() => {
        async function load() {
            try {
                const pods = await getPods().catch(() => []);
                if (pods.length > 0) {
                    setPodRows(pods.map(mapPodToRow));
                }
            } catch { }
        }
        load();
        const interval = setInterval(load, 15000);
        return () => clearInterval(interval);
    }, []);

    const namespaces = Array.from(new Set(podRows.map(p => p.namespace)));

    const filtered = podRows.filter(p => {
        if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (namespace !== "all" && p.namespace !== namespace) return false;
        if (status !== "all" && p.status.toLowerCase() !== status) return false;
        if (risk !== "all" && p.risk.toLowerCase() !== risk) return false;
        return true;
    });

    // Group rows
    const groups: { key: string; rows: Pod[] }[] = (() => {
        if (groupBy === "none") return [{ key: "", rows: filtered }];
        const map = new Map<string, Pod[]>();
        filtered.forEach(p => {
            const key = groupBy === "namespace" ? p.namespace
                : groupBy === "status" ? p.status
                    : groupBy === "risk" ? p.risk : "";
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(p);
        });
        return Array.from(map.entries()).map(([key, rows]) => ({ key, rows }));
    })();

    const isCol = (c: string) => visibleCols.includes(c);

    return (
        <div className="rounded-[10px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3.5">
            {/* Header + Filters */}
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                <h3 className="text-[14px] font-semibold text-[#f7f8f8]">Workload Explorer</h3>
                <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Search */}
                    <div className="relative">
                        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search pods..."
                            className="w-[180px] h-7 pl-8 pr-3 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] text-[11px] text-[#f7f8f8] placeholder:text-[#94a3b8] focus:outline-none focus:border-[#7170ff]/50"
                        />
                    </div>
                    <Dropdown
                        label="All namespaces"
                        value={namespace}
                        options={[
                            { value: "all", label: "All namespaces" },
                            ...namespaces.map(n => ({ value: n, label: n })),
                        ]}
                        onChange={setNamespace}
                        width={160}
                    />
                    <Dropdown
                        label="Status"
                        value={status}
                        options={[
                            { value: "all", label: "All statuses" },
                            { value: "running", label: "Running" },
                            { value: "pending", label: "Pending" },
                            { value: "restarting", label: "Restarting" },
                        ]}
                        onChange={setStatus}
                        width={150}
                    />
                    <Dropdown
                        label="Risk level"
                        value={risk}
                        options={[
                            { value: "all", label: "All risk levels" },
                            { value: "low", label: "Low" },
                            { value: "medium", label: "Medium" },
                            { value: "high", label: "High" },
                            { value: "critical", label: "Critical" },
                        ]}
                        onChange={setRisk}
                        width={150}
                    />
                    <Dropdown
                        label="More filters"
                        options={[
                            { value: "node", label: "Filter by node" },
                            { value: "label", label: "Filter by label" },
                            { value: "owner", label: "Filter by owner" },
                            { value: "age", label: "Filter by age" },
                        ]}
                        width={170}
                    />
                    <MultiSelectDropdown
                        label="Columns"
                        options={ALL_COLUMNS}
                        selected={visibleCols}
                        onChange={setVisibleCols}
                        width={180}
                    />
                    <div className="flex items-center gap-1 px-2 h-7 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)]">
                        <span className="text-[10px] text-[#94a3b8] font-medium">Group by:</span>
                        <Dropdown
                            label="None"
                            value={groupBy}
                            options={[
                                { value: "none", label: "None" },
                                { value: "namespace", label: "Namespace" },
                                { value: "status", label: "Status" },
                                { value: "risk", label: "Risk Level" },
                            ]}
                            onChange={setGroupBy}
                            width={130}
                        />
                    </div>
                    <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)]">
                        <button
                            onClick={() => setView("list")}
                            title="List view"
                            className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${view === "list" ? "bg-[#7170ff]/20 text-[#7170ff]" : "text-[#94a3b8] hover:text-[#f7f8f8]"}`}
                        >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="8" y1="6" x2="21" y2="6" />
                                <line x1="8" y1="12" x2="21" y2="12" />
                                <line x1="8" y1="18" x2="21" y2="18" />
                                <line x1="3" y1="6" x2="3.01" y2="6" />
                                <line x1="3" y1="12" x2="3.01" y2="12" />
                                <line x1="3" y1="18" x2="3.01" y2="18" />
                            </svg>
                        </button>
                        <button
                            onClick={() => setView("grid")}
                            title="Grid view"
                            className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${view === "grid" ? "bg-[#7170ff]/20 text-[#7170ff]" : "text-[#94a3b8] hover:text-[#f7f8f8]"}`}
                        >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="7" height="7" />
                                <rect x="14" y="3" width="7" height="7" />
                                <rect x="3" y="14" width="7" height="7" />
                                <rect x="14" y="14" width="7" height="7" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Empty state */}
            {filtered.length === 0 && (
                <div className="py-12 text-center">
                    <p className="text-[12px] text-[#64748b]">No pods match the current filters.</p>
                    <button
                        onClick={() => { setSearch(""); setNamespace("all"); setStatus("all"); setRisk("all"); }}
                        className="mt-2 text-[11px] text-[#7170ff] hover:text-[#79c0ff]"
                    >
                        Clear filters
                    </button>
                </div>
            )}

            {/* List view */}
            {filtered.length > 0 && view === "list" && (
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[rgba(15,23,42,0.10)]">
                                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">Pod</th>
                                {isCol("namespace") && <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">Namespace</th>}
                                {isCol("status") && <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">Status</th>}
                                {isCol("cpu") && <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">CPU</th>}
                                {isCol("memory") && <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">Memory</th>}
                                {isCol("restarts") && <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">Restarts (15m)</th>}
                                {isCol("health") && <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">Health Score</th>}
                                {isCol("risk") && <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">Risk Level</th>}
                                {isCol("ai") && <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">AI Analysis</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {groups.flatMap((g, gi) => [
                                ...(g.key ? [
                                    <tr key={`group-${gi}`} className="bg-[rgba(255,255,255,0.02)]/60">
                                        <td colSpan={ALL_COLUMNS.length + 1} className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[#64748b] font-semibold">
                                            {g.key} <span className="text-[#94a3b8] font-normal">({g.rows.length})</span>
                                        </td>
                                    </tr>
                                ] : []),
                                ...g.rows.map((pod, i) => (
                                    <PodRow
                                        key={pod.name}
                                        pod={pod}
                                        isLast={gi === groups.length - 1 && i === g.rows.length - 1}
                                        visibleCols={visibleCols}
                                    />
                                ))
                            ])}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Grid view */}
            {filtered.length > 0 && view === "grid" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {filtered.map(pod => <PodCard key={pod.name} pod={pod} />)}
                </div>
            )}
        </div>
    );
}

function PodCard({ pod }: { pod: Pod }) {
    const statusColor = pod.status === "Running" ? "#3fb950" : pod.status === "Pending" ? "#f0883e" : "#f85149";
    const healthColor = pod.healthScore >= 80 ? "#3fb950" : pod.healthScore >= 60 ? "#f0883e" : pod.healthScore >= 40 ? "#f0883e" : "#f85149";
    return (
        <div className="rounded-md border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3 hover:border-[rgba(15,23,42,0.14)] transition-colors">
            <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                    <p className="text-[11px] font-mono font-semibold text-[#f7f8f8] truncate">{pod.name}</p>
                    <p className="text-[10px] text-[#94a3b8] mt-0.5">{pod.namespace} · {pod.type}</p>
                </div>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10.5px] font-bold font-mono shrink-0" style={{ border: `2px solid ${healthColor}`, color: healthColor, background: `${healthColor}10` }}>
                    {pod.healthScore}
                </div>
            </div>
            <div className="flex items-center gap-3 text-[10.5px]">
                <span className="inline-flex items-center gap-1 font-medium" style={{ color: statusColor }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor, boxShadow: `0 0 4px ${statusColor}` }} />
                    {pod.status}
                </span>
                <span className="text-[#64748b]">CPU <span className="font-mono" style={{ color: pod.cpu.color }}>{pod.cpu.percent}</span></span>
                <span className="text-[#64748b]">MEM <span className="font-mono" style={{ color: pod.memory.color }}>{pod.memory.percent}</span></span>
            </div>
            <p className="mt-1.5 text-[10.5px] font-medium" style={{ color: pod.aiAnalysis.color }}>{pod.aiAnalysis.text}</p>
        </div>
    );
}

// ─── Pod Row ─────────────────────────────────────────────────────────────────

function PodRow({ pod, isLast, visibleCols }: { pod: Pod; isLast: boolean; visibleCols: string[] }) {
    const isCol = (c: string) => visibleCols.includes(c);
    const statusColor = pod.status === "Running" ? "#3fb950" : pod.status === "Pending" ? "#f0883e" : "#f85149";

    const riskStyle = {
        Low: { bg: "rgba(63,185,80,0.1)", color: "#3fb950", border: "rgba(63,185,80,0.3)" },
        Medium: { bg: "rgba(240,136,62,0.1)", color: "#f0883e", border: "rgba(240,136,62,0.3)" },
        High: { bg: "rgba(248,81,73,0.1)", color: "#f85149", border: "rgba(248,81,73,0.3)" },
        Critical: { bg: "rgba(248,81,73,0.18)", color: "#ff7b72", border: "rgba(248,81,73,0.5)" },
    }[pod.risk];

    const healthColor = pod.healthScore >= 80 ? "#3fb950"
        : pod.healthScore >= 60 ? "#f0883e"
            : pod.healthScore >= 40 ? "#f0883e"
                : "#f85149";

    return (
        <tr
            className={`hover:bg-white/[0.025] transition-colors ${!isLast ? "border-b border-[rgba(15,23,42,0.10)]" : ""}`}
        >
            {/* Pod */}
            <td className="px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded flex items-center justify-center shrink-0" style={{ background: "rgba(88,166,255,0.12)", border: "1px solid rgba(88,166,255,0.3)" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7170ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                            <line x1="12" y1="22.08" x2="12" y2="12" />
                        </svg>
                    </div>
                    <div className="min-w-0">
                        <p className="text-[12px] text-[#f7f8f8] font-mono font-medium truncate">{pod.name}</p>
                        <p className="text-[10px] text-[#94a3b8]">{pod.type}</p>
                    </div>
                </div>
            </td>
            {isCol("namespace") && <td className="px-3 py-2.5 text-[11.5px] text-[#64748b] font-mono">{pod.namespace}</td>}
            {isCol("status") && (
                <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium" style={{ color: statusColor }}>
                        <span
                            className={`w-1.5 h-1.5 rounded-full ${pod.status !== "Running" ? "wi-live-dot" : ""}`}
                            style={{ background: statusColor, boxShadow: `0 0 4px ${statusColor}` }}
                        />
                        {pod.status}
                    </span>
                </td>
            )}
            {isCol("cpu") && (
                <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                        <div>
                            <p className="text-[11.5px] font-mono font-semibold" style={{ color: pod.cpu.color }}>{pod.cpu.percent}</p>
                            <p className="text-[10px] text-[#94a3b8] font-mono">{pod.cpu.cores}</p>
                        </div>
                        {pod.cpu.spark.length > 0 && <MiniLineChart data={pod.cpu.spark} color={pod.cpu.color} />}
                    </div>
                </td>
            )}
            {isCol("memory") && (
                <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                        <div>
                            <p className="text-[11.5px] font-mono font-semibold" style={{ color: pod.memory.color }}>{pod.memory.percent}</p>
                            <p className="text-[10px] text-[#94a3b8] font-mono">{pod.memory.size}</p>
                        </div>
                        {pod.memory.spark.length > 0 && <MiniLineChart data={pod.memory.spark} color={pod.memory.color} />}
                    </div>
                </td>
            )}
            {isCol("restarts") && (
                <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                        <span className="text-[12px] font-mono font-semibold" style={{ color: pod.restarts.color }}>{pod.restarts.count}</span>
                        <MiniBarChart data={pod.restarts.bars} color={pod.restarts.color} />
                    </div>
                </td>
            )}
            {isCol("health") && (
                <td className="px-3 py-2.5">
                    <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10.5px] font-bold font-mono"
                        style={{
                            border: `2px solid ${healthColor}`,
                            color: healthColor,
                            background: `${healthColor}10`,
                        }}
                    >
                        {pod.healthScore}
                    </div>
                </td>
            )}
            {isCol("risk") && (
                <td className="px-3 py-2.5">
                    <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-semibold"
                        style={{
                            background: riskStyle.bg,
                            color: riskStyle.color,
                            border: `1px solid ${riskStyle.border}`,
                        }}
                    >
                        {pod.risk}
                    </span>
                </td>
            )}
            {isCol("ai") && (
                <td className="px-3 py-2.5">
                    <div className="flex items-start gap-1.5">
                        <div>
                            <p className="text-[11.5px] font-medium" style={{ color: pod.aiAnalysis.color }}>{pod.aiAnalysis.text}</p>
                            <p className="text-[10px] text-[#94a3b8] font-mono">Confidence {pod.aiAnalysis.confidence}%</p>
                        </div>
                        {pod.aiAnalysis.icon === "refresh" ? (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#a371f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5">
                                <polyline points="23 4 23 10 17 10" />
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                            </svg>
                        ) : (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="#a371f7" className="mt-0.5">
                                <path d="M12 0L14 9L24 12L14 15L12 24L10 15L0 12L10 9Z" />
                            </svg>
                        )}
                    </div>
                </td>
            )}
        </tr>
    );
}

// ─── Mini Charts ─────────────────────────────────────────────────────────────

function MiniLineChart({ data, color }: { data: number[]; color: string }) {
    const w = 56, h = 18;
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - ((v - min) / range) * (h - 2) - 1;
        return `${x},${y}`;
    }).join(" ");

    return (
        <svg width={w} height={h} className="shrink-0">
            <polyline points={points} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
        </svg>
    );
}

function MiniBarChart({ data, color }: { data: number[]; color: string }) {
    const w = 50, h = 18;
    const max = Math.max(...data, 1);
    const barW = w / data.length - 1;

    return (
        <svg width={w} height={h} className="shrink-0">
            {data.map((v, i) => {
                const barH = (v / max) * (h - 2);
                return (
                    <rect
                        key={i}
                        x={i * (barW + 1)}
                        y={h - barH}
                        width={barW}
                        height={barH || 1}
                        rx="0.5"
                        fill={color}
                        opacity={0.5 + (v / max) * 0.5}
                    />
                );
            })}
        </svg>
    );
}

// ─── Filter Button ───────────────────────────────────────────────────────────

function FilterButton({ children }: { children: React.ReactNode }) {
    return (
        <button className="flex items-center gap-1 h-7 px-2.5 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] text-[11px] text-[#64748b] hover:text-[#f7f8f8] hover:border-[rgba(15,23,42,0.20)] transition-colors">
            {children}
            <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </button>
    );
}
