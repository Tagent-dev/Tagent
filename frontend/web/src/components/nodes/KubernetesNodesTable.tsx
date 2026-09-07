"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getNodes, getMetricsSummary, type NodeInfo, type MetricsSummary } from "@/lib/api";
import { Dropdown } from "@/components/workload/Dropdown";

// ─── Node Data ───────────────────────────────────────────────────────────────

interface NodeRow {
    name: string;
    role: "Worker" | "System";
    roleColor: string;
    statusDot: string;
    statusBadge: string;
    statusBadgeColor: string;
    instanceType: string;
    region: string;
    uptime: string;
    kubelet: string;
    cpu: { percent: number; spark: string; sparkColor: string };
    memory: { percent: number; usage: string; spark: string; sparkColor: string };
    disk: { read: string; readIops: string; write: string; writeIops: string };
    pods: { count: number; capacity: number };
    health: { score: number; label: string; description: string; color: string };
}

function generateSparkFromPercent(percent: number): string {
    const points: string[] = [];
    let y = 18 - (percent / 100) * 16;
    for (let x = 0; x <= 96; x += 12) {
        y = Math.max(2, Math.min(18, y + (Math.random() * 4 - 2)));
        points.push(`${x},${Math.round(y)}`);
    }
    return points.join(" ");
}

function parseMemoryToGB(mem: string): number {
    if (!mem) return 0;
    if (mem.endsWith("Gi")) return parseFloat(mem);
    if (mem.endsWith("Mi")) return parseFloat(mem) / 1024;
    if (mem.endsWith("Ki")) return parseFloat(mem) / (1024 * 1024);
    return parseFloat(mem) / (1024 * 1024 * 1024);
}

function mapNodeInfoToRow(node: NodeInfo, nodeMetric: { cpu_percent: number; memory_percent: number; disk_percent: number } | undefined): NodeRow {
    const isReady = node.status === "Ready";
    const isSystem = node.role.toLowerCase().includes("master") || node.role.toLowerCase().includes("control");
    const cpuPercent = nodeMetric?.cpu_percent ?? 0;
    const memPercent = nodeMetric?.memory_percent ?? 0;
    const memCapGB = parseMemoryToGB(node.memory_capacity);
    const memUsedGB = memCapGB * (memPercent / 100);
    const podCapacity = parseInt(node.pod_capacity) || 0;
    const podPercent = podCapacity > 0 ? Math.round((node.pod_count / podCapacity) * 100) : 0;

    const cpuColor = cpuPercent >= 80 ? "#f85149" : cpuPercent >= 60 ? "#f0883e" : "#22d3ee";
    const memColor = memPercent >= 80 ? "#f85149" : memPercent >= 60 ? "#f0883e" : "#a371f7";

    // Health score derived from CPU + memory + status
    const healthScore = isReady ? Math.max(0, Math.round(100 - (cpuPercent * 0.3 + memPercent * 0.3))) : 40;
    const healthLabel = healthScore >= 90 ? "Excellent" : healthScore >= 70 ? "Good" : healthScore >= 50 ? "Warning" : "Critical";
    const healthColor = healthScore >= 90 ? "#3fb950" : healthScore >= 70 ? "#7170ff" : healthScore >= 50 ? "#f0883e" : "#f85149";
    const healthDesc = healthScore >= 90 ? "Node is healthy and performing optimally."
        : healthScore >= 70 ? "Node is performing well."
            : healthScore >= 50 ? "High resource usage identified."
                : "Node needs immediate attention.";

    return {
        name: node.name,
        role: isSystem ? "System" : "Worker",
        roleColor: isSystem ? "#a371f7" : "#7170ff",
        statusDot: isReady ? "#3fb950" : "#f85149",
        statusBadge: isReady ? "✓" : "!",
        statusBadgeColor: isReady ? "#3fb950" : "#f85149",
        instanceType: "—",
        region: node.internal_ip || "—",
        uptime: node.age || "—",
        kubelet: "—",
        cpu: { percent: cpuPercent, spark: generateSparkFromPercent(cpuPercent), sparkColor: cpuColor },
        memory: { percent: memPercent, usage: `${memUsedGB.toFixed(1)} / ${memCapGB.toFixed(0)} GB`, spark: generateSparkFromPercent(memPercent), sparkColor: memColor },
        disk: { read: "—", readIops: "—", write: "—", writeIops: "—" },
        pods: { count: node.pod_count, capacity: podPercent },
        health: { score: healthScore, label: healthLabel, description: healthDesc, color: healthColor },
    };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function KubernetesNodesTable() {
    const [search, setSearch] = useState("");
    const [region, setRegion] = useState("all");
    const [status, setStatus] = useState("all");
    const [role, setRole] = useState("all");
    const [view, setView] = useState<"list" | "grid">("list");
    const [nodeRows, setNodeRows] = useState<NodeRow[]>([]);

    useEffect(() => {
        async function load() {
            try {
                const [nodes, metrics] = await Promise.all([
                    getNodes().catch(() => []),
                    getMetricsSummary().catch(() => null),
                ]);
                const nodeMetrics = metrics?.node_metrics || [];
                const rows = (nodes || []).map((n: NodeInfo) => {
                    const metric = nodeMetrics.find(m => m.node === n.name);
                    return mapNodeInfoToRow(n, metric);
                });
                setNodeRows(rows);
            } catch { }
        }
        load();
        const interval = setInterval(load, 15000);
        return () => clearInterval(interval);
    }, []);

    const regions = ["all", ...Array.from(new Set(nodeRows.map(n => n.region).filter(r => r !== "—")))];

    const filtered = nodeRows.filter(n => {
        if (search && !n.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (region !== "all" && n.region !== region) return false;
        if (status !== "all" && n.statusBadgeColor !== (status === "healthy" ? "#3fb950" : status === "warning" ? "#f0883e" : "#f85149")) return false;
        if (role !== "all" && n.role.toLowerCase() !== role) return false;
        return true;
    });

    return (
        <div className="rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3.5">
            {/* Header + Filters */}
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                <h3 className="text-[14px] font-semibold text-[#f7f8f8]">Kubernetes Nodes</h3>
                <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="relative">
                        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search nodes..."
                            className="w-[160px] h-7 pl-8 pr-3 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] text-[11px] text-[#f7f8f8] placeholder:text-[#94a3b8] focus:outline-none focus:border-[#7170ff]/50"
                        />
                    </div>
                    <Dropdown
                        label="All Regions"
                        value={region}
                        options={[
                            { value: "all", label: "All Regions" },
                            ...regions.filter(r => r !== "all").map(r => ({ value: r, label: r })),
                        ]}
                        onChange={setRegion}
                        width={160}
                    />
                    <Dropdown
                        label="All Status"
                        value={status}
                        options={[
                            { value: "all", label: "All Status" },
                            { value: "healthy", label: "Healthy" },
                            { value: "warning", label: "Warning" },
                            { value: "critical", label: "Critical" },
                        ]}
                        onChange={setStatus}
                        width={150}
                    />
                    <Dropdown
                        label="All Roles"
                        value={role}
                        options={[
                            { value: "all", label: "All Roles" },
                            { value: "worker", label: "Worker" },
                            { value: "system", label: "System" },
                        ]}
                        onChange={setRole}
                        width={140}
                    />
                    <button className="flex items-center gap-1 h-7 px-2.5 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] text-[11px] text-[#64748b] hover:text-[#f7f8f8] hover:border-[rgba(15,23,42,0.20)] transition-colors">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <line x1="3" y1="12" x2="21" y2="12" />
                            <line x1="3" y1="18" x2="21" y2="18" />
                        </svg>
                        Columns
                        <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
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

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                    <thead>
                        <tr className="border-b border-[rgba(15,23,42,0.10)]">
                            <Th>Node</Th>
                            <Th>Role &amp; Info</Th>
                            <Th>CPU</Th>
                            <Th>Memory</Th>
                            <Th>Disk I/O</Th>
                            <Th>Pods</Th>
                            <Th>Health &amp; AI Analysis</Th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((n, i) => (
                            <NodeTableRow key={n.name} node={n} isLast={i === filtered.length - 1} />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function Th({ children }: { children: React.ReactNode }) {
    return <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">{children}</th>;
}

// ─── Node Row ────────────────────────────────────────────────────────────────

function NodeTableRow({ node, isLast }: { node: NodeRow; isLast: boolean }) {
    return (
        <tr className={`hover:bg-white/[0.025] transition-colors cursor-pointer ${!isLast ? "border-b border-[rgba(15,23,42,0.10)]" : ""}`}>
            {/* Node */}
            <td className="px-3 py-3">
                <Link href={`/nodes/${encodeURIComponent(node.name)}`} className="flex items-center gap-2.5 group">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: node.statusDot, boxShadow: `0 0 4px ${node.statusDot}` }} />
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <p className="text-[12px] font-mono font-semibold text-[#7170ff] group-hover:text-[#79c0ff] group-hover:underline transition-colors">{node.name}</p>
                            <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold" style={{ background: node.statusBadgeColor, color: "#191a1b" }}>
                                {node.statusBadge}
                            </span>
                        </div>
                        <p className="text-[10px] text-[#64748b] mt-0.5">{node.role} Node</p>
                    </div>
                </Link>
            </td>
            {/* Role & Info */}
            <td className="px-3 py-3">
                <div className="flex flex-col gap-0.5">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold w-fit" style={{ background: `${node.roleColor}20`, color: node.roleColor, border: `1px solid ${node.roleColor}40` }}>
                        {node.role}
                    </span>
                    <p className="text-[10.5px] text-[#64748b] mt-1">
                        Uptime <span className="text-[#f7f8f8] font-mono ml-1">{node.uptime}</span>
                    </p>
                    <p className="text-[10.5px] text-[#64748b]">
                        K8s <span className="text-[#f7f8f8] font-mono ml-1">{node.kubelet}</span>
                    </p>
                </div>
            </td>
            {/* CPU */}
            <td className="px-3 py-3">
                <div className="flex items-center gap-2.5">
                    <PercentDonut value={node.cpu.percent} color={node.cpu.sparkColor} />
                    <Sparkline points={node.cpu.spark} color={node.cpu.sparkColor} width={70} />
                </div>
            </td>
            {/* Memory */}
            <td className="px-3 py-3">
                <div className="flex items-center gap-2.5">
                    <PercentDonut value={node.memory.percent} color={node.memory.sparkColor} />
                    <div className="flex flex-col">
                        <Sparkline points={node.memory.spark} color={node.memory.sparkColor} width={70} />
                        <p className="text-[9.5px] text-[#64748b] font-mono mt-0.5">{node.memory.usage}</p>
                    </div>
                </div>
            </td>
            {/* Disk I/O */}
            <td className="px-3 py-3">
                <div className="text-[10.5px] font-mono">
                    <p><span className="text-[#3fb950] font-semibold">↓ {node.disk.read}</span> <span className="text-[#64748b]">{node.disk.readIops}</span></p>
                    <p className="mt-0.5"><span className="text-[#7170ff] font-semibold">↑ {node.disk.write}</span> <span className="text-[#64748b]">Write IOPS</span></p>
                </div>
            </td>
            {/* Pods */}
            <td className="px-3 py-3">
                <p className="text-[16px] font-bold text-[#f7f8f8] leading-none">{node.pods.count}</p>
                <p className="text-[9.5px] text-[#64748b] mt-0.5">Pods</p>
                <p className="text-[10.5px] font-semibold text-[#3fb950] mt-1">{node.pods.capacity}%</p>
                <p className="text-[9.5px] text-[#64748b]">Capacity</p>
            </td>
            {/* Health & AI Analysis */}
            <td className="px-3 py-3">
                <div className="flex items-center gap-2.5">
                    <HealthCircle score={node.health.score} color={node.health.color} />
                    <div className="min-w-0">
                        <p className="text-[12px] font-semibold" style={{ color: node.health.color }}>{node.health.label}</p>
                        <p className="text-[10px] text-[#64748b] leading-snug">{node.health.description}</p>
                    </div>
                </div>
            </td>
        </tr>
    );
}

// ─── Percent Donut ───────────────────────────────────────────────────────────

function PercentDonut({ value, color }: { value: number; color: string }) {
    const r = 18;
    const c = 2 * Math.PI * r;
    const offset = c - (value / 100) * c;
    return (
        <div className="relative shrink-0">
            <svg width="44" height="44" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(15,23,42,0.10)" strokeWidth="3" />
                <circle
                    cx="22" cy="22" r={r}
                    fill="none"
                    stroke={color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={c}
                    strokeDashoffset={offset}
                    transform="rotate(-90 22 22)"
                    style={{ filter: `drop-shadow(0 0 3px ${color}80)` }}
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10.5px] font-bold font-mono" style={{ color }}>{value}%</span>
            </div>
        </div>
    );
}

function HealthCircle({ score, color }: { score: number; color: string }) {
    return (
        <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-[11.5px] font-bold font-mono shrink-0"
            style={{
                border: `2px solid ${color}`,
                color,
                background: `${color}10`,
                boxShadow: `0 0 8px ${color}40`,
            }}
        >
            {score}
        </div>
    );
}

function Sparkline({ points, color, width = 96 }: { points: string; color: string; width?: number }) {
    const id = color.replace("#", "") + "-tl";
    return (
        <svg width={width} height="22" viewBox="0 0 96 20" preserveAspectRatio="none" className="shrink-0">
            <defs>
                <linearGradient id={`gn-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={color} stopOpacity="0.35" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <polygon points={`${points} 96,20 0,20`} fill={`url(#gn-${id})`} />
            <polyline points={points} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}
