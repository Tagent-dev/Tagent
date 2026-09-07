"use client";

import { useEffect, useState } from "react";
import { getRemediationHistory, type RemediationResult } from "@/lib/api";
import { FileText, Loader2, WifiOff } from "lucide-react";

export default function AuditPage() {
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
                        <h1 className="text-lg font-semibold text-zinc-100">Audit Log</h1>
                        <p className="text-sm text-zinc-500 mt-0.5">{history.length} actions recorded</p>
                    </div>
                    {loading && <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />}
                    {error && <WifiOff className="w-4 h-4 text-amber-400" />}
                </div>
            </header>
            <div className="px-6 py-5">
                {history.length === 0 && !loading ? (
                    <div className="text-center py-12">
                        <FileText className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
                        <p className="text-sm text-zinc-400">{error ? "Cannot reach service" : "No audit entries yet"}</p>
                    </div>
                ) : (
                    <div className="rounded-lg border border-zinc-800 overflow-hidden">
                        <table className="w-full text-[11px]">
                            <thead className="bg-[rgba(255,255,255,0.02)] border-b border-zinc-800">
                                <tr>
                                    <th className="text-left px-4 py-2.5 text-[#64748b]">Action</th>
                                    <th className="text-left px-4 py-2.5 text-[#64748b]">Target</th>
                                    <th className="text-left px-4 py-2.5 text-[#64748b]">Status</th>
                                    <th className="text-left px-4 py-2.5 text-[#64748b]">Message</th>
                                    <th className="text-left px-4 py-2.5 text-[#64748b]">Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/50">
                                {history.map((r, i) => (
                                    <tr key={i} className="hover:bg-[rgba(255,255,255,0.02)]">
                                        <td className="px-4 py-2.5 text-[#f7f8f8] font-mono">{r.action}</td>
                                        <td className="px-4 py-2.5 text-[#64748b] font-mono">{r.target}</td>
                                        <td className="px-4 py-2.5">
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${r.status === "success" ? "bg-emerald-500/10 text-emerald-400" : r.status === "failed" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"}`}>{r.status}</span>
                                        </td>
                                        <td className="px-4 py-2.5 text-[#64748b] max-w-[200px] truncate">{r.message}</td>
                                        <td className="px-4 py-2.5 text-[#64748b]">{r.timestamp?.slice(0, 19)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
