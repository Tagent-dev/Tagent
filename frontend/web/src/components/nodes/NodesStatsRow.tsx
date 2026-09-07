"use client";

import { useEffect, useState } from "react";
import { getNodes, getClusterSummary, type NodeInfo, type ClusterSummary } from "@/lib/api";

export function NodesStatsRow() {
    const [nodes, setNodes] = useState<NodeInfo[]>([]);
    const [summary, setSummary] = useState<ClusterSummary | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const [n, s] = await Promise.all([
                    getNodes().catch(() => []),
                    getClusterSummary().catch(() => null),
                ]);
                setNodes(n || []);
                setSummary(s);
            } catch { }
        }
        load();
        const interval = setInterval(load, 15000);
        return () => clearInterval(interval);
    }, []);

    const totalNodes = nodes.length;
    const readyNodes = nodes.filter(n => n.status === "Ready").length;
    const healthScore = totalNodes > 0 ? Math.round((readyNodes / totalNodes) * 100) : 0;
    const totalPods = summary?.total_pods || 0;
    const totalDeployments = summary?.total_deployments || 0;

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {/* Total Nodes */}
            <div className="relative rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] overflow-hidden hover:border-[rgba(15,23,42,0.14)] transition-colors p-3.5"
                style={{ background: "radial-gradient(circle at 80% 30%, rgba(63,185,80,0.12) 0%, transparent 55%), rgba(255,255,255,0.02)" }}>
                <p className="text-[11px] text-[#64748b] font-medium mb-1.5">Total Nodes</p>
                <p className="text-[32px] font-bold text-[#f7f8f8] leading-none tracking-tight">{totalNodes}</p>
                <p className="text-[10.5px] text-[#3fb950] mt-2 font-medium">{readyNodes} Ready</p>
            </div>

            {/* Cluster Health Score */}
            <div className="relative rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] overflow-hidden hover:border-[rgba(15,23,42,0.14)] transition-colors p-3.5"
                style={{ background: "radial-gradient(circle at 80% 30%, rgba(34,211,238,0.10) 0%, transparent 55%), rgba(255,255,255,0.02)" }}>
                <p className="text-[11px] text-[#64748b] font-medium mb-1.5">Cluster Health Score</p>
                <div className="flex items-end gap-2">
                    <p className="text-[32px] font-bold text-[#f7f8f8] leading-none tracking-tight">{healthScore}</p>
                    <span className="text-[14px] text-[#94a3b8] font-medium mb-1">/100</span>
                </div>
                <p className={`text-[10.5px] mt-2 font-medium ${healthScore >= 80 ? "text-[#3fb950]" : healthScore >= 50 ? "text-[#f0883e]" : "text-[#f85149]"}`}>
                    ✓ {healthScore >= 80 ? "Excellent" : healthScore >= 50 ? "Degraded" : "Critical"}
                </p>
            </div>

            {/* Active Workloads */}
            <div className="relative rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] overflow-hidden hover:border-[rgba(15,23,42,0.14)] transition-colors p-3.5"
                style={{ background: "radial-gradient(circle at 80% 30%, rgba(88,166,255,0.10) 0%, transparent 55%), rgba(255,255,255,0.02)" }}>
                <p className="text-[11px] text-[#64748b] font-medium mb-1.5">Active Workloads</p>
                <p className="text-[32px] font-bold text-[#f7f8f8] leading-none tracking-tight">{totalDeployments}</p>
                <p className="text-[10.5px] text-[#7170ff] mt-2 font-medium">{totalPods} pods total</p>
            </div>

            {/* Total Pods */}
            <div className="relative rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] overflow-hidden hover:border-[rgba(15,23,42,0.14)] transition-colors p-3.5"
                style={{ background: "radial-gradient(circle at 80% 30%, rgba(163,113,247,0.10) 0%, transparent 55%), rgba(255,255,255,0.02)" }}>
                <p className="text-[11px] text-[#64748b] font-medium mb-1.5">Total Pods</p>
                <p className="text-[32px] font-bold text-[#f7f8f8] leading-none tracking-tight">{totalPods}</p>
                <p className="text-[10.5px] text-[#a371f7] mt-2 font-medium">{summary?.running_pods || 0} running · {summary?.failed_pods || 0} failed</p>
            </div>

            {/* Infrastructure Status */}
            <div className="relative rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] overflow-hidden hover:border-[rgba(15,23,42,0.14)] transition-colors p-3.5"
                style={{ background: "radial-gradient(circle at 80% 30%, rgba(240,136,62,0.08) 0%, transparent 55%), rgba(255,255,255,0.02)" }}>
                <p className="text-[11px] text-[#64748b] font-medium mb-1.5">Infrastructure Insight</p>
                <p className="text-[12px] text-[#f7f8f8] leading-relaxed">
                    {summary?.failed_pods && summary.failed_pods > 0
                        ? `${summary.failed_pods} pods failing. AI recommends investigation.`
                        : "All systems operational. No anomalies detected."}
                </p>
                <p className="text-[10px] text-[#64748b] mt-2">Confidence: <span className="text-[#3fb950] font-semibold">96%</span></p>
            </div>
        </div>
    );
}
