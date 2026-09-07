"use client";

import { useEffect, useState } from "react";
import { getFleetClusters, type ClusterRegistration } from "@/lib/api";

// ─── Cluster Health Distribution (donut chart) ───────────────────────────────

interface Segment {
    label: string;
    count: number;
    percent: number;
    color: string;
}

function deriveSegments(clusters: ClusterRegistration[]): Segment[] {
    if (clusters.length === 0) return [];
    const total = clusters.length;
    const healthy = clusters.filter(c => c.status === "healthy" || c.health_score >= 80).length;
    const warning = clusters.filter(c => (c.health_score >= 50 && c.health_score < 80)).length;
    const critical = clusters.filter(c => c.health_score < 50).length;
    const unknown = Math.max(0, total - healthy - warning - critical);
    return [
        { label: "Healthy", count: healthy, percent: total > 0 ? Math.round((healthy / total) * 100) : 0, color: "#3fb950" },
        { label: "Warning", count: warning, percent: total > 0 ? Math.round((warning / total) * 100) : 0, color: "#f0883e" },
        { label: "Critical", count: critical, percent: total > 0 ? Math.round((critical / total) * 100) : 0, color: "#f85149" },
        { label: "Unknown", count: unknown, percent: total > 0 ? Math.round((unknown / total) * 100) : 0, color: "#94a3b8" },
    ];
}

export function ClusterHealthDistribution() {
    const [segments, setSegments] = useState<Segment[]>([]);

    useEffect(() => {
        async function load() {
            try {
                const data = await getFleetClusters().catch(() => ({ clusters: [], total: 0 }));
                setSegments(deriveSegments(data.clusters || []));
            } catch { }
        }
        load();
        const interval = setInterval(load, 15000);
        return () => clearInterval(interval);
    }, []);

    const total = segments.reduce((s, seg) => s + seg.count, 0);
    const r = 40;
    const c = 2 * Math.PI * r;

    // Build donut segments
    let accumulated = 0;
    const arcs = segments.filter(s => s.percent > 0).map(s => {
        const start = accumulated;
        accumulated += s.percent;
        return { ...s, startOffset: c - (start / 100) * c, length: (s.percent / 100) * c };
    });

    return (
        <div className="rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3.5">
            <h3 className="text-[13px] font-semibold text-[#f7f8f8] mb-3">Cluster Health Distribution</h3>
            <div className="flex items-center gap-4">
                {/* Donut */}
                <div className="relative shrink-0">
                    <svg width="100" height="100" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(15,23,42,0.10)" strokeWidth="8" />
                        {arcs.map((arc, i) => (
                            <circle
                                key={i}
                                cx="50" cy="50" r={r}
                                fill="none"
                                stroke={arc.color}
                                strokeWidth="8"
                                strokeLinecap="round"
                                strokeDasharray={`${arc.length} ${c - arc.length}`}
                                strokeDashoffset={arc.startOffset}
                                transform="rotate(-90 50 50)"
                                style={{ filter: `drop-shadow(0 0 3px ${arc.color})` }}
                            />
                        ))}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-[20px] font-bold text-[#f7f8f8] font-mono leading-none">{total}</span>
                        <span className="text-[9px] text-[#64748b]">Total</span>
                    </div>
                </div>
                {/* Legend */}
                <div className="space-y-2">
                    {segments.map((s, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                            <span className="text-[11px] text-[#64748b]">{s.label}</span>
                            <span className="text-[11px] text-[#f7f8f8] font-mono font-semibold ml-auto">{s.count} ({s.percent}%)</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
