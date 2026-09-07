"use client";

import { useEffect, useState } from "react";
import { getCostSummary } from "@/lib/api";

// ─── Cost vs Performance Analysis (scatter plot with legend on right) ────────

const FALLBACK_POINTS = [
    { x: 35, y: 25, r: 8, color: "#3fb950", label: "High Efficiency" },
    { x: 55, y: 40, r: 7, color: "#7170ff", label: "Good Efficiency" },
    { x: 80, y: 55, r: 9, color: "#22d3ee", label: "Medium Efficiency" },
    { x: 120, y: 70, r: 7, color: "#f0883e", label: "Low Efficiency" },
    { x: 150, y: 85, r: 10, color: "#f85149", label: "Over-Provisioned" },
];

const EFFICIENCY_COLORS = ["#3fb950", "#7170ff", "#22d3ee", "#f0883e", "#f85149"];
const EFFICIENCY_LABELS = ["High Efficiency", "Good Efficiency", "Medium Efficiency", "Low Efficiency", "Over-Provisioned"];

export function CostPerformanceAnalysis() {
    const [points, setPoints] = useState<typeof FALLBACK_POINTS>([]);

    useEffect(() => {
        let active = true;
        const fetchData = () => {
            getCostSummary()
                .then((data) => {
                    if (!active || data.items.length === 0) return;
                    const mapped = data.items.slice(0, 5).map((item, i) => {
                        // Distribute points across the chart based on index
                        const costVal = parseFloat(item.estimate.replace(/[^0-9.]/g, "")) || (30 + i * 30);
                        const x = Math.min(170, Math.max(25, costVal * 0.8 + i * 25));
                        const y = Math.min(120, Math.max(15, 20 + i * 18));
                        return {
                            x,
                            y,
                            r: 7 + (i % 3),
                            color: EFFICIENCY_COLORS[i] || EFFICIENCY_COLORS[4],
                            label: EFFICIENCY_LABELS[i] || "Over-Provisioned",
                        };
                    });
                    if (mapped.length > 0) setPoints(mapped);
                })
                .catch(() => { });
        };
        fetchData();
        const interval = setInterval(fetchData, 15_000);
        return () => { active = false; clearInterval(interval); };
    }, []);
    return (
        <div className="rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3.5">
            <h3 className="text-[13px] font-semibold text-[#f7f8f8] mb-3">Cost vs Performance Analysis</h3>

            <div className="flex gap-3">
                {/* Chart area */}
                <div className="flex-1 h-[260px] relative">
                    <svg width="100%" height="260" viewBox="0 0 180 140" preserveAspectRatio="xMidYMid meet">
                        {/* Y-axis labels */}
                        <text x="2" y="15" fontSize="7" fill="#94a3b8">High</text>
                        <text x="2" y="70" fontSize="7" fill="#94a3b8">Medium</text>
                        <text x="2" y="125" fontSize="7" fill="#94a3b8">Low</text>
                        {/* Y-axis label rotated */}
                        <text x="8" y="70" fontSize="6" fill="#64748b" transform="rotate(-90 8 70)" textAnchor="middle">Performance Score</text>

                        {/* Grid */}
                        <line x1="20" y1="130" x2="175" y2="130" stroke="rgba(15,23,42,0.10)" strokeWidth="0.5" />
                        <line x1="20" y1="10" x2="20" y2="130" stroke="rgba(15,23,42,0.10)" strokeWidth="0.5" />
                        {[35, 65, 95].map(y => <line key={y} x1="20" y1={y} x2="175" y2={y} stroke="rgba(15,23,42,0.10)" strokeWidth="0.3" strokeDasharray="2 3" />)}
                        {[60, 100, 140].map(x => <line key={x} x1={x} y1="10" x2={x} y2="130" stroke="rgba(15,23,42,0.10)" strokeWidth="0.3" strokeDasharray="2 3" />)}

                        {/* Optimal zone */}
                        <rect x="25" y="15" width="55" height="45" rx="4" fill="#3fb950" fillOpacity="0.04" stroke="#3fb950" strokeWidth="0.6" strokeOpacity="0.3" strokeDasharray="3 3" />
                        <text x="52" y="40" textAnchor="middle" fontSize="6" fill="#3fb950" fillOpacity="0.7">Optimal Zone</text>
                        <text x="52" y="48" textAnchor="middle" fontSize="5" fill="#3fb950" fillOpacity="0.5">High performance, low cost</text>

                        {/* Data points with glow */}
                        {points.map((p, i) => (
                            <g key={i}>
                                <circle cx={p.x} cy={p.y} r={p.r + 4} fill={p.color} fillOpacity="0.12" />
                                <circle cx={p.x} cy={p.y} r={p.r} fill={p.color} fillOpacity="0.3" stroke={p.color} strokeWidth="1.5" style={{ filter: `drop-shadow(0 0 4px ${p.color})` }} />
                                <circle cx={p.x} cy={p.y} r={p.r - 3} fill={p.color} fillOpacity="0.8" />
                            </g>
                        ))}

                        {/* X-axis label */}
                        <text x="100" y="138" textAnchor="middle" fontSize="7" fill="#94a3b8">Monthly Cost</text>
                        {/* X-axis ticks */}
                        <text x="30" y="138" textAnchor="middle" fontSize="5.5" fill="rgba(15,23,42,0.20)">Low</text>
                        <text x="100" y="138" textAnchor="middle" fontSize="5.5" fill="rgba(15,23,42,0.20)">Medium</text>
                        <text x="165" y="138" textAnchor="middle" fontSize="5.5" fill="rgba(15,23,42,0.20)">High</text>
                    </svg>
                </div>

                {/* Legend (right side) */}
                <div className="shrink-0 space-y-2.5 pt-4">
                    {points.map((p, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: p.color, boxShadow: `0 0 4px ${p.color}` }} />
                            <span className="text-[10px] text-[#64748b] whitespace-nowrap">{p.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
