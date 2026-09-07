"use client";

import { useEffect, useState } from "react";
import { getMetricsSummary, type MetricsSummary } from "@/lib/api";

const POINT_COLORS = ["#3fb950", "#7170ff", "#a371f7", "#22d3ee", "#f0883e"];

interface ScatterPoint {
    x: number;
    y: number;
    r: number;
    color: string;
    label: string;
}

export function CostReliabilityAnalysis() {
    const [points, setPoints] = useState<ScatterPoint[]>([]);

    useEffect(() => {
        const load = () => {
            getMetricsSummary()
                .then((data: MetricsSummary) => {
                    if (data.node_metrics && data.node_metrics.length > 0) {
                        const mapped = data.node_metrics.slice(0, 5).map((node, i) => ({
                            x: 20 + (node.cpu_percent / 100) * 170,
                            y: 110 - (node.memory_percent / 100) * 100,
                            r: 3 + (node.disk_percent / 100) * 3,
                            color: POINT_COLORS[i % POINT_COLORS.length],
                            label: node.node,
                        }));
                        setPoints(mapped);
                    } else {
                        setPoints([
                            { x: 40, y: 90, r: 4, color: "#3fb950", label: "Node 1" },
                            { x: 80, y: 60, r: 5, color: "#7170ff", label: "Node 2" },
                            { x: 120, y: 40, r: 3, color: "#a371f7", label: "Node 3" },
                            { x: 150, y: 70, r: 4, color: "#22d3ee", label: "Node 4" },
                            { x: 170, y: 95, r: 3, color: "#f0883e", label: "Node 5" },
                        ]);
                    }
                })
                .catch(() => null);
        };
        load();
        const id = setInterval(load, 15000);
        return () => clearInterval(id);
    }, []);

    return (
        <div className="rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3.5">
            <h3 className="text-[13px] font-semibold text-[#f7f8f8] mb-3">Cost vs Reliability Analysis</h3>
            {/* Scatter plot */}
            <div className="h-[140px] relative mb-3">
                <svg width="100%" height="140" viewBox="0 0 200 120" preserveAspectRatio="none">
                    {/* Axes */}
                    <line x1="20" y1="110" x2="195" y2="110" stroke="rgba(15,23,42,0.10)" strokeWidth="0.5" />
                    <line x1="20" y1="5" x2="20" y2="110" stroke="rgba(15,23,42,0.10)" strokeWidth="0.5" />
                    {/* Grid lines */}
                    {[30, 55, 80].map(y => <line key={y} x1="20" y1={y} x2="195" y2={y} stroke="rgba(15,23,42,0.10)" strokeWidth="0.3" strokeDasharray="2 3" />)}
                    {/* Data points */}
                    {points.map((p, i) => (
                        <g key={i}>
                            <circle cx={p.x} cy={p.y} r={p.r + 4} fill={p.color} fillOpacity="0.15" />
                            <circle cx={p.x} cy={p.y} r={p.r} fill={p.color} style={{ filter: `drop-shadow(0 0 3px ${p.color})` }} />
                        </g>
                    ))}
                    {/* Axis labels */}
                    <text x="100" y="118" textAnchor="middle" fontSize="7" fill="#94a3b8">Cost Efficiency →</text>
                    <text x="5" y="60" textAnchor="middle" fontSize="7" fill="#94a3b8" transform="rotate(-90 5 60)">High</text>
                </svg>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-3">
                {points.map(l => (
                    <span key={l.label} className="flex items-center gap-1 text-[9.5px] text-[#64748b]">
                        <span className="w-2 h-2 rounded-full" style={{ background: l.color }} />{l.label}
                    </span>
                ))}
            </div>
        </div>
    );
}
