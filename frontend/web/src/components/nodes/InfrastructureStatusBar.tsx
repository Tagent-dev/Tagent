"use client";

import { useEffect, useState } from "react";
import { getMetricsSummary, getClusterSummary, getNodes, type MetricsSummary, type ClusterSummary, type NodeInfo } from "@/lib/api";

// ─── Bottom status bar ───────────────────────────────────────────────────────

export function InfrastructureStatusBar() {
    const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
    const [summary, setSummary] = useState<ClusterSummary | null>(null);
    const [nodes, setNodes] = useState<NodeInfo[]>([]);

    useEffect(() => {
        async function load() {
            try {
                const [m, s, n] = await Promise.all([
                    getMetricsSummary().catch(() => null),
                    getClusterSummary().catch(() => null),
                    getNodes().catch(() => []),
                ]);
                setMetrics(m);
                setSummary(s);
                setNodes(n || []);
            } catch { }
        }
        load();
        const interval = setInterval(load, 15000);
        return () => clearInterval(interval);
    }, []);

    // Derive values from API data
    const readyNodes = summary?.ready_nodes ?? nodes.filter(n => n.status === "Ready").length;
    const totalNodesOnline = readyNodes || nodes.length;
    const workloadsRunning = summary?.running_pods ?? summary?.total_pods ?? 0;

    // Calculate total memory from nodes
    const totalMemoryGB = nodes.reduce((sum, n) => {
        const mem = n.memory_capacity || "0";
        // Parse memory like "32Gi", "16384Mi", etc.
        if (mem.endsWith("Gi")) return sum + parseFloat(mem);
        if (mem.endsWith("Mi")) return sum + parseFloat(mem) / 1024;
        if (mem.endsWith("Ki")) return sum + parseFloat(mem) / (1024 * 1024);
        return sum + parseFloat(mem) / (1024 * 1024 * 1024);
    }, 0);
    const totalMemoryStr = totalMemoryGB >= 1024 ? `${(totalMemoryGB / 1024).toFixed(1)} TB` : `${Math.round(totalMemoryGB)} GB`;

    // Estimate storage (we'll show pod capacity as a proxy)
    const totalPodCapacity = nodes.reduce((sum, n) => sum + (parseInt(n.pod_capacity) || 0), 0);
    const storageStr = totalPodCapacity > 0 ? `${totalPodCapacity}` : "—";

    // Calculate SLA from cluster health
    const totalNodes = summary?.total_nodes ?? nodes.length;
    const slaPercent = totalNodes > 0 ? ((readyNodes / totalNodes) * 100).toFixed(2) : "99.99";

    // Alerts count for network throughput approximation
    const alertCount = metrics?.alerts?.length ?? 0;
    const isHealthy = alertCount === 0 && readyNodes === totalNodes;

    return (
        <div className="rounded-[10px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px]">
            <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isHealthy ? "#3fb950" : "#f0883e"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
                <span className="text-[#64748b]">Infrastructure Pulse</span>
                <span className={`inline-flex items-center gap-1 font-semibold ${isHealthy ? "text-[#3fb950]" : "text-[#f0883e]"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isHealthy ? "bg-[#3fb950]" : "bg-[#f0883e]"}`} style={{ boxShadow: `0 0 4px ${isHealthy ? "#3fb950" : "#f0883e"}`, animation: "wi-pulse 2s infinite" }} />
                    {isHealthy ? "Live" : "Degraded"}
                </span>
            </div>
            <Stat icon="server" iconColor="#7170ff" value={String(totalNodesOnline)} label="Nodes Online" />
            <Stat icon="layers" iconColor="#a371f7" value={String(workloadsRunning)} label="Workloads Running" />
            <Stat icon="memory" iconColor="#22d3ee" value={totalMemoryStr} label="Total Memory" />
            <Stat icon="storage" iconColor="#3fb950" value={`${storageStr} pods max`} label="Pod Capacity" />
            <Stat icon="network" iconColor="#7170ff" value={alertCount > 0 ? `${alertCount} alerts` : "0 alerts"} label="Active Alerts" />
            <div className="flex items-center gap-2 ml-auto">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={parseFloat(slaPercent) >= 99 ? "#3fb950" : "#f0883e"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <polyline points="9 12 11 14 15 10" />
                </svg>
                <span className={`font-mono font-bold ${parseFloat(slaPercent) >= 99 ? "text-[#3fb950]" : "text-[#f0883e]"}`}>{slaPercent}%</span>
                <span className="text-[#64748b]">Node Health</span>
            </div>
        </div>
    );
}

function Stat({ icon, iconColor, value, label }: { icon: string; iconColor: string; value: string; label: string }) {
    return (
        <div className="flex items-center gap-2">
            <StatIcon icon={icon} color={iconColor} />
            <span className="font-bold text-[#f7f8f8] font-mono">{value}</span>
            <span className="text-[#64748b]">{label}</span>
        </div>
    );
}

function StatIcon({ icon, color }: { icon: string; color: string }) {
    const props = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
    if (icon === "server") return (
        <svg {...props}>
            <rect x="2" y="2" width="20" height="8" rx="2" />
            <rect x="2" y="14" width="20" height="8" rx="2" />
            <line x1="6" y1="6" x2="6.01" y2="6" />
            <line x1="6" y1="18" x2="6.01" y2="18" />
        </svg>
    );
    if (icon === "layers") return (
        <svg {...props}>
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
        </svg>
    );
    if (icon === "memory") return (
        <svg {...props}>
            <rect x="3" y="6" width="18" height="12" rx="2" />
            <line x1="7" y1="10" x2="7" y2="14" />
            <line x1="11" y1="10" x2="11" y2="14" />
            <line x1="15" y1="10" x2="15" y2="14" />
            <line x1="19" y1="10" x2="19" y2="14" />
        </svg>
    );
    if (icon === "storage") return (
        <svg {...props}>
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
            <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
        </svg>
    );
    // network
    return (
        <svg {...props}>
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
    );
}
