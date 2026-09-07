"use client";

import { useEffect, useState } from "react";
import { getMetricsSummary, getNetworkMetrics, type MetricsSummary, type NetworkMetrics } from "@/lib/api";

// ─── Fleet Resource Overview (bottom-right) ──────────────────────────────────

interface Metric {
    label: string;
    value: string;
    change: string;
    changeColor: string;
    sparkColor: string;
    sparkPoints: string;
}

function generateSparkPoints(baseValue: number): string {
    const points: string[] = [];
    let y = 10;
    for (let x = 0; x <= 100; x += 10) {
        y = Math.max(3, Math.min(16, 16 - (baseValue / 100) * 12 + ((x * 7 + baseValue) % 5) - 2));
        points.push(`${x},${y}`);
    }
    return points.join(" ");
}

function deriveMetrics(metrics: MetricsSummary | null, network: NetworkMetrics | null): Metric[] {
    if (!metrics && !network) return [];
    const cpu = metrics ? Math.round(metrics.cluster_cpu_percent) : 0;
    const mem = metrics ? Math.round(metrics.cluster_memory_percent) : 0;
    const netBandwidth = network?.total_bandwidth || "—";
    return [
        { label: "CPU Utilization", value: `${cpu}%`, change: cpu > 70 ? `+${cpu - 60}%` : `${cpu - 50}%`, changeColor: cpu > 70 ? "#f0883e" : "#3fb950", sparkColor: "#22d3ee", sparkPoints: generateSparkPoints(cpu) },
        { label: "Memory Utilization", value: `${mem}%`, change: mem > 70 ? `+${mem - 60}%` : `${mem - 50}%`, changeColor: mem > 70 ? "#f0883e" : "#3fb950", sparkColor: "#a371f7", sparkPoints: generateSparkPoints(mem) },
        { label: "Network I/O", value: netBandwidth, change: network ? `↑${formatBytesShort(network.transmit_bytes_per_sec)} ↓${formatBytesShort(network.receive_bytes_per_sec)}` : "—", changeColor: "#3fb950", sparkColor: "#3fb950", sparkPoints: generateSparkPoints(50) },
    ];
}

function formatBytesShort(bytes: number): string {
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)}GB/s`;
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)}MB/s`;
    if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(0)}KB/s`;
    return `${Math.round(bytes)}B/s`;
}

export function FleetResourceOverview() {
    const [metrics, setMetrics] = useState<Metric[]>([]);

    useEffect(() => {
        async function load() {
            try {
                const [data, network] = await Promise.all([
                    getMetricsSummary().catch(() => null),
                    getNetworkMetrics().catch(() => null),
                ]);
                setMetrics(deriveMetrics(data, network));
            } catch { }
        }
        load();
        const interval = setInterval(load, 15000);
        return () => clearInterval(interval);
    }, []);
    return (
        <div className="rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3.5">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <h3 className="text-[13px] font-semibold text-[#f7f8f8]">Fleet Resource Overview</h3>
                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#3fb950]/10 border border-[#3fb950]/30">
                        <span className="w-1 h-1 rounded-full bg-[#3fb950]" style={{ boxShadow: "0 0 4px #3fb950", animation: "wi-pulse 2s infinite" }} />
                        <span className="text-[9px] text-[#3fb950] font-semibold">Live</span>
                    </div>
                </div>
            </div>
            <div className="space-y-3">
                {metrics.map((m, i) => (
                    <div key={i}>
                        <div className="flex items-baseline justify-between mb-1">
                            <span className="text-[10.5px] text-[#64748b]">{m.label}</span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-[16px] font-bold text-[#f7f8f8] font-mono">{m.value}</span>
                                <span className="text-[10px] font-semibold" style={{ color: m.changeColor }}>{m.change}</span>
                            </div>
                        </div>
                        <svg width="100%" height="20" viewBox="0 0 100 18" preserveAspectRatio="none">
                            <defs>
                                <linearGradient id={`fr-${i}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor={m.sparkColor} stopOpacity="0.4" />
                                    <stop offset="100%" stopColor={m.sparkColor} stopOpacity="0" />
                                </linearGradient>
                            </defs>
                            <polygon points={`${m.sparkPoints} 100,18 0,18`} fill={`url(#fr-${i})`} />
                            <polyline points={m.sparkPoints} fill="none" stroke={m.sparkColor} strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                    </div>
                ))}
            </div>
        </div>
    );
}
