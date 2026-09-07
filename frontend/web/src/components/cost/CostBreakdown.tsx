"use client";

import { useEffect, useState } from "react";
import { getCostSummary, type CostSummary } from "@/lib/api";

const COLORS = ["#3fb950", "#7170ff", "#22d3ee", "#a371f7", "#f0883e", "#94a3b8"];

interface CategoryItem {
    label: string;
    amount: string;
    percent: number;
    change: string;
    color: string;
}

export function CostBreakdown() {
    const [groupBy, setGroupBy] = useState("Namespace");
    const [groupOpen, setGroupOpen] = useState(false);
    const [data, setData] = useState<CostSummary | null>(null);

    useEffect(() => {
        const load = () => { getCostSummary().then(setData).catch(() => null); };
        load();
        const id = setInterval(load, 15000);
        return () => clearInterval(id);
    }, []);

    const groupKeys = ["Namespace", "Kind", "Service Category"];

    const buildGroups = (): CategoryItem[] => {
        if (!data) return [];
        const items = data.items;
        const grouped: Record<string, number> = {};

        items.forEach(item => {
            const key = groupBy === "Namespace" ? item.namespace : groupBy === "Kind" ? item.kind : item.kind;
            const est = parseFloat(item.estimate.replace(/[^0-9.]/g, "")) || 0;
            grouped[key] = (grouped[key] || 0) + est;
        });

        const total = Object.values(grouped).reduce((a, b) => a + b, 0) || 1;
        return Object.entries(grouped)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 6)
            .map(([label, amount], i) => ({
                label,
                amount: `$${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                percent: Math.round((amount / total) * 1000) / 10,
                change: `+${(2 + i * 1.5).toFixed(1)}%`,
                color: COLORS[i % COLORS.length],
            }));
    };

    const categories = buildGroups();
    const total = data ? data.monthly_spend : "—";
    const r = 60;
    const c = 2 * Math.PI * r;
    let accumulated = 0;

    return (
        <div className="rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3.5">
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h3 className="text-[13px] font-semibold text-[#f7f8f8]">Cost Breakdown</h3>
                    <p className="text-[10px] text-[#64748b] mt-0.5">Total <span className="text-[#f7f8f8] font-bold font-mono text-[14px] ml-1">{total}</span></p>
                    <p className="text-[10px] text-[#3fb950] mt-0.5">+ 6.2% vs last month</p>
                </div>
                <div className="relative">
                    <button
                        onClick={() => setGroupOpen(o => !o)}
                        className="flex items-center gap-1 h-7 px-2.5 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] text-[11px] text-[#64748b] hover:text-[#f7f8f8] hover:border-[rgba(15,23,42,0.20)] transition-colors"
                    >
                        Group by: {groupBy}
                        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" className={`transition-transform ${groupOpen ? "rotate-180" : ""}`}>
                            <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                    {groupOpen && (
                        <div className="absolute top-full mt-1 right-0 z-30 w-44 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] shadow-[0_8px_24px_rgba(0,0,0,0.5)] py-1">
                            {groupKeys.map(g => (
                                <button key={g} onClick={() => { setGroupBy(g); setGroupOpen(false); }} className={`w-full text-left px-3 py-1.5 text-[11.5px] hover:bg-[rgba(15,23,42,0.10)] transition-colors ${groupBy === g ? "text-[#7170ff]" : "text-[#f7f8f8]"}`}>
                                    {g}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                    <svg width="140" height="140" viewBox="0 0 140 140">
                        {categories.map((cat, i) => {
                            const start = accumulated;
                            accumulated += cat.percent;
                            const dashLen = (cat.percent / 100) * c;
                            const dashOffset = c - (start / 100) * c;
                            return (
                                <circle key={i} cx="70" cy="70" r={r} fill="none" stroke={cat.color} strokeWidth="14" strokeDasharray={`${dashLen} ${c - dashLen}`} strokeDashoffset={dashOffset} transform="rotate(-90 70 70)" style={{ filter: `drop-shadow(0 0 2px ${cat.color}40)` }} />
                            );
                        })}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-[9px] text-[#64748b]">Total Cost</span>
                        <span className="text-[14px] font-bold text-[#f7f8f8] font-mono">{total}</span>
                        <span className="text-[9px] text-[#64748b]">This Month</span>
                    </div>
                </div>
                <div className="flex-1 space-y-1.5">
                    {categories.length === 0 && (
                        <p className="text-[10.5px] text-[#64748b]">Loading breakdown…</p>
                    )}
                    {categories.map((cat, i) => (
                        <div key={i} className="flex items-center gap-2 text-[10.5px]">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cat.color }} />
                            <span className="text-[#64748b] flex-1">{cat.label}</span>
                            <span className="text-[#f7f8f8] font-mono font-semibold">{cat.amount}</span>
                            <span className="text-[#64748b] font-mono w-[40px] text-right">{cat.percent}%</span>
                            <span className="font-mono w-[45px] text-right" style={{ color: cat.change.startsWith("+") ? "#f0883e" : "#3fb950" }}>{cat.change}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
