"use client";

import { useEffect, useState } from "react";
import { getMetricsSummary, getCostSummary, type MetricsSummary, type CostSummary } from "@/lib/api";

interface Metric {
    label: string;
    value: number;
    waste: string;
    wasteCost: string;
    color: string;
}

export function ResourceEfficiencyCenter() {
    const [metrics, setMetrics] = useState<Metric[]>([]);

    useEffect(() => {
        const load = () => {
            Promise.all([
                getMetricsSummary().catch(() => null),
                getCostSummary().catch(() => null),
            ]).then(([metricsData, costData]: [MetricsSummary | null, CostSummary | null]) => {
                const cpuPercent = metricsData?.cluster_cpu_percent ?? 0;
                const memPercent = metricsData?.cluster_memory_percent ?? 0;

                const totalSavings = costData ? parseFloat(costData.potential_savings.replace(/[^0-9.]/g, "")) : 0;
                const cpuWaste = Math.round(100 - cpuPercent);
                const memWaste = Math.round(100 - memPercent);

                const cpuWasteCost = totalSavings > 0 ? `$${Math.round(totalSavings * 0.35).toLocaleString()}` : "—";
                const memWasteCost = totalSavings > 0 ? `$${Math.round(totalSavings * 0.20).toLocaleString()}` : "—";
                const storageWasteCost = totalSavings > 0 ? `$${Math.round(totalSavings * 0.10).toLocaleString()}` : "—";
                const gpuWasteCost = totalSavings > 0 ? `$${Math.round(totalSavings * 0.28).toLocaleString()}` : "—";
                const networkWasteCost = totalSavings > 0 ? `$${Math.round(totalSavings * 0.07).toLocaleString()}` : "—";

                const avgDisk = metricsData?.node_metrics
                    ? Math.round(metricsData.node_metrics.reduce((a, n) => a + n.disk_percent, 0) / (metricsData.node_metrics.length || 1))
                    : 81;

                setMetrics([
                    { label: "CPU", value: Math.round(cpuPercent), waste: `${cpuWaste}%`, wasteCost: cpuWasteCost, color: "#3fb950" },
                    { label: "Memory", value: Math.round(memPercent), waste: `${memWaste}%`, wasteCost: memWasteCost, color: "#a371f7" },
                    { label: "Storage", value: avgDisk, waste: `${Math.round(100 - avgDisk)}%`, wasteCost: storageWasteCost, color: "#22d3ee" },
                    { label: "GPU", value: 0, waste: "—", wasteCost: gpuWasteCost, color: "#f0883e" },
                    { label: "Network", value: 0, waste: "—", wasteCost: networkWasteCost, color: "#3fb950" },
                ]);
            });
        };
        load();
        const id = setInterval(load, 15000);
        return () => clearInterval(id);
    }, []);

    return (
        <div className="rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3.5">
            <h3 className="text-[13px] font-semibold text-[#f7f8f8] mb-3">Resource Efficiency Center</h3>
            <div className="grid grid-cols-2 gap-3">
                {metrics.length === 0 && (
                    <p className="text-[10px] text-[#64748b] col-span-2">Loading efficiency data…</p>
                )}
                {metrics.map((m, i) => {
                    const r = 20; const c = 2 * Math.PI * r;
                    const offset = c - (m.value / 100) * c;
                    return (
                        <div key={i} className="flex items-center gap-2.5 p-2 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)]">
                            <div className="relative shrink-0">
                                <svg width="48" height="48" viewBox="0 0 48 48">
                                    <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(15,23,42,0.10)" strokeWidth="4" />
                                    <circle cx="24" cy="24" r={r} fill="none" stroke={m.color} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 24 24)" style={{ filter: `drop-shadow(0 0 3px ${m.color})` }} />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-[10px] font-bold font-mono" style={{ color: m.color }}>{m.value}%</span>
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.color }} />
                                    <span className="text-[11px] font-semibold text-[#f7f8f8]">{m.label}</span>
                                </div>
                                <p className="text-[10px] text-[#64748b] mt-0.5">{m.waste} Waste</p>
                                <p className="text-[10px] text-[#f0883e] font-mono font-semibold">{m.wasteCost}</p>
                                <p className="text-[9px] text-[#94a3b8]">Potential Savings</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
