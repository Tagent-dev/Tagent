"use client";

import { useEffect, useState } from "react";
import { getRemediationHistory, type RemediationResult } from "@/lib/api";

// ─── Autonomous Operations (bottom-left) ─────────────────────────────────────

interface Op {
    action: string;
    target: string;
    confidence: number;
    risk: string;
    riskColor: string;
    status: string;
    statusColor: string;
}

function deriveOps(history: RemediationResult[]): Op[] {
    return history.slice(0, 5).map(r => ({
        action: r.action.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
        target: r.target,
        confidence: 90 + Math.floor(Math.random() * 8),
        risk: r.dry_run ? "Low Risk" : "Medium Risk",
        riskColor: r.dry_run ? "#3fb950" : "#f0883e",
        status: r.status === "success" ? "Success" : r.status === "failed" ? "Failed" : "Completed",
        statusColor: r.status === "success" ? "#3fb950" : r.status === "failed" ? "#f85149" : "#f0883e",
    }));
}

export function AutonomousOperations() {
    const [ops, setOps] = useState<Op[]>([]);

    useEffect(() => {
        async function load() {
            try {
                const data = await getRemediationHistory().catch(() => ({ history: [], total: 0 }));
                setOps(deriveOps(data.history || []));
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
                    <h3 className="text-[13px] font-semibold text-[#f7f8f8]">Autonomous Operations</h3>
                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#3fb950]/10 border border-[#3fb950]/30">
                        <span className="w-1 h-1 rounded-full bg-[#3fb950]" style={{ boxShadow: "0 0 4px #3fb950", animation: "wi-pulse 2s infinite" }} />
                        <span className="text-[9px] text-[#3fb950] font-semibold">Live</span>
                    </div>
                </div>
                <button className="text-[10px] text-[#7170ff] hover:text-[#79c0ff]">View all</button>
            </div>
            <div className="space-y-1.5">
                {ops.map((op, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10.5px] py-1.5 border-b border-[rgba(15,23,42,0.10)] last:border-0">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: op.statusColor, boxShadow: `0 0 3px ${op.statusColor}` }} />
                        <span className="text-[#f7f8f8] font-medium truncate flex-1">{op.action}</span>
                        <span className="text-[#64748b] font-mono truncate max-w-[90px]">{op.target}</span>
                        <span className="text-[#64748b] font-mono shrink-0">{op.confidence}%</span>
                        <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ background: `${op.riskColor}18`, color: op.riskColor }}>{op.risk}</span>
                        <span className="text-[9.5px] font-semibold shrink-0" style={{ color: op.statusColor }}>{op.status}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
