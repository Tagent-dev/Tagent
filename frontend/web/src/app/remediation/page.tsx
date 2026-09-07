"use client";

import { useEffect, useState } from "react";
import { getRemediationHistory, type RemediationResult } from "@/lib/api";
import { Shield, Loader2, WifiOff } from "lucide-react";

export default function RemediationPage() {
    const [history, setHistory] = useState<RemediationResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const data = await getRemediationHistory();
                setHistory(data.history || []);
                setError(null);
            } catch (e: any) { setError(e.message); }
            finally { setLoading(false); }
        }
        load();
    }, []);

    return (
        <div className="flex-1 overflow-y-auto scrollbar bg-[rgba(255,255,255,0.02)]">
            <header className="px-6 py-5 border-b border-zinc-800/60">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-semibold text-zinc-100">Remediation History</h1>
                        <p className="text-sm text-zinc-500 mt-0.5">{history.length} actions executed</p>
                    </div>
                    {loading && <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />}
                    {error && <WifiOff className="w-4 h-4 text-amber-400" />}
                </div>
            </header>
            <div className="px-6 py-5 space-y-2">
                {history.length === 0 && !loading && (
                    <div className="text-center py-12">
                        <Shield className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
                        <p className="text-sm text-zinc-400">{error ? "Cannot reach remediation service" : "No remediation actions yet"}</p>
                    </div>
                )}
                {history.map((r, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
                        <span className={`w-2.5 h-2.5 rounded-full ${r.status === "success" ? "bg-emerald-400" : r.status === "failed" ? "bg-red-400" : r.status === "blocked" ? "bg-amber-400" : "bg-zinc-500"}`} />
                        <div className="flex-1 min-w-0">
                            <p className="text-[12px] text-[#f7f8f8] font-medium">{r.action} → {r.target}</p>
                            <p className="text-[10px] text-[#64748b] mt-0.5">{r.message}</p>
                        </div>
                        <div className="text-right shrink-0">
                            <span className={`text-[10px] font-semibold ${r.status === "success" ? "text-emerald-400" : r.status === "failed" ? "text-red-400" : "text-amber-400"}`}>{r.status}{r.dry_run ? " (dry-run)" : ""}</span>
                            <p className="text-[9px] text-[#64748b] mt-0.5">{r.timestamp?.slice(0, 19)}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
