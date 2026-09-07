"use client";

import { useEffect, useState } from "react";
import { getMetricsSummary, type MetricsSummary } from "@/lib/api";
import { BarChart3, Loader2, WifiOff } from "lucide-react";

export default function MetricsPage() {
    const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const data = await getMetricsSummary();
                setMetrics(data);
                setError(null);
            } catch (e: any) { setError(e.message); }
            finally { setLoading(false); }
        }
        load();
        const interval = setInterval(load, 15000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex-1 overflow-y-auto scrollbar bg-[rgba(255,255,255,0.02)]">
            <header className="px-6 py-5 border-b border-zinc-800/60">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-semibold text-zinc-100">Metrics</h1>
                        <p className="text-sm text-zinc-500 mt-0.5">Cluster resource utilization from Prometheus</p>
                    </div>
                    {loading && <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />}
                    {error && <WifiOff className="w-4 h-4 text-amber-400" />}
                </div>
            </header>
            <div className="px-6 py-5 space-y-4">
                {!metrics && !loading && (
                    <div className="text-center py-12">
                        <BarChart3 className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
                        <p className="text-sm text-zinc-400">{error ? "Cannot reach Prometheus" : "No metrics available"}</p>
                    </div>
                )}
                {metrics && (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-4">
                                <p className="text-[11px] text-[#64748b] mb-2">Cluster CPU</p>
                                <p className="text-[28px] font-bold font-mono text-[#22d3ee]">{metrics.cluster_cpu_percent?.toFixed(1) || 0}%</p>
                                <div className="mt-2 h-2 bg-[rgba(15,23,42,0.10)] rounded-full overflow-hidden">
                                    <div className="h-full bg-[#22d3ee] rounded-full" style={{ width: `${metrics.cluster_cpu_percent || 0}%` }} />
                                </div>
                            </div>
                            <div className="rounded-lg border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-4">
                                <p className="text-[11px] text-[#64748b] mb-2">Cluster Memory</p>
                                <p className="text-[28px] font-bold font-mono text-[#a371f7]">{metrics.cluster_memory_percent?.toFixed(1) || 0}%</p>
                                <div className="mt-2 h-2 bg-[rgba(15,23,42,0.10)] rounded-full overflow-hidden">
                                    <div className="h-full bg-[#a371f7] rounded-full" style={{ width: `${metrics.cluster_memory_percent || 0}%` }} />
                                </div>
                            </div>
                        </div>
                        {metrics.alerts && metrics.alerts.length > 0 && (
                            <div className="rounded-lg border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-4">
                                <h3 className="text-[13px] font-semibold text-[#f7f8f8] mb-3">Active Alerts</h3>
                                <div className="space-y-2">
                                    {metrics.alerts.map((a, i) => (
                                        <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)]">
                                            <span className={`w-2 h-2 rounded-full ${a.severity === "critical" ? "bg-red-400" : "bg-amber-400"}`} />
                                            <span className="text-[11px] text-[#f7f8f8]">{a.name}</span>
                                            <span className="text-[10px] text-[#64748b] ml-auto">{a.message}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
