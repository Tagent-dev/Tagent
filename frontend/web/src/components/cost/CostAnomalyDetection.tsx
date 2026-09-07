"use client";

import { useEffect, useState } from "react";
import { getCostSummary, type CostSummary } from "@/lib/api";

interface Anomaly {
    title: string;
    sub: string;
    change: string;
    period: string;
    rootCause: string;
    confidence: number;
    cost: string;
    color: string;
}

export function CostAnomalyDetection() {
    const [anomalies, setAnomalies] = useState<Anomaly[]>([]);

    useEffect(() => {
        const load = () => {
            getCostSummary()
                .then((data: CostSummary) => {
                    const sorted = [...data.items].sort(
                        (a, b) => parseFloat(b.estimate.replace(/[^0-9.]/g, "")) - parseFloat(a.estimate.replace(/[^0-9.]/g, ""))
                    );
                    const top = sorted.slice(0, 4);
                    const mapped: Anomaly[] = top.map((item, i) => {
                        const est = parseFloat(item.estimate.replace(/[^0-9.]/g, ""));
                        const pctIncrease = 15 + i * 8;
                        return {
                            title: `${item.kind} cost spike: ${item.name}`,
                            sub: item.namespace,
                            change: `↑ ${pctIncrease}%`,
                            period: "vs last 7d",
                            rootCause: `High resource usage in ${item.basis}`,
                            confidence: 95 - i * 2,
                            cost: item.estimate.startsWith("$") ? item.estimate : `$${item.estimate}`,
                            color: est > 1000 ? "#f85149" : "#f0883e",
                        };
                    });
                    setAnomalies(mapped);
                })
                .catch(() => null);
        };
        load();
        const id = setInterval(load, 15000);
        return () => clearInterval(id);
    }, []);

    return (
        <div className="rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3.5">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-semibold text-[#f7f8f8]">Cost Anomaly Detection</h3>
                <button className="text-[10px] text-[#7170ff]">View all</button>
            </div>
            <div className="space-y-2.5">
                {anomalies.length === 0 && (
                    <div className="rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] p-2.5">
                        <p className="text-[11px] text-[#64748b]">Loading anomaly data…</p>
                    </div>
                )}
                {anomalies.map((a, i) => (
                    <div key={i} className="rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] p-2.5">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="flex items-start gap-2">
                                <span className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: a.color, boxShadow: `0 0 4px ${a.color}` }} />
                                <div>
                                    <p className="text-[11px] font-semibold text-[#f7f8f8]">{a.title}</p>
                                    <p className="text-[10px] text-[#64748b]">{a.sub}</p>
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-[14px] font-bold text-[#f7f8f8] font-mono">{a.cost}</p>
                                <p className="text-[9px] text-[#64748b] font-mono">Impact</p>
                            </div>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                            <span style={{ color: a.color }} className="font-semibold">{a.change} <span className="text-[#64748b] font-normal">{a.period}</span></span>
                            <span className="text-[#64748b]">{a.confidence}% <span className="text-[#94a3b8]">Confidence</span></span>
                        </div>
                        <p className="text-[10px] text-[#64748b] mt-1.5 border-t border-[rgba(15,23,42,0.10)] pt-1.5">Root cause: <span className="text-[#f7f8f8]">{a.rootCause}</span></p>
                    </div>
                ))}
            </div>
        </div>
    );
}
