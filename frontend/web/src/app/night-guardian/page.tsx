"use client";

import { useEffect, useState } from "react";
import { getNightGuardianStatus, getNightGuardianReports, type NightGuardianStatus, type NightGuardianReport } from "@/lib/api";
import { Shield, Loader2, WifiOff } from "lucide-react";

export default function NightGuardianPage() {
    const [status, setStatus] = useState<NightGuardianStatus | null>(null);
    const [reports, setReports] = useState<NightGuardianReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const [s, r] = await Promise.all([
                    getNightGuardianStatus().catch(() => null),
                    getNightGuardianReports().catch(() => ({ reports: [], total: 0 })),
                ]);
                if (s) setStatus(s);
                setReports(r.reports || []);
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
                        <h1 className="text-lg font-semibold text-zinc-100">Night Guardian</h1>
                        <p className="text-sm text-zinc-500 mt-0.5">Autonomous overnight remediation</p>
                    </div>
                    {loading && <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />}
                    {error && <WifiOff className="w-4 h-4 text-amber-400" />}
                </div>
            </header>
            <div className="px-6 py-5 space-y-4">
                {status && (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="rounded-lg border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3">
                                <p className="text-[10px] text-[#64748b] mb-1">Status</p>
                                <p className={`text-[16px] font-bold ${status.config.enabled ? "text-emerald-400" : "text-zinc-500"}`}>{status.config.enabled ? "ENABLED" : "DISABLED"}</p>
                            </div>
                            <div className="rounded-lg border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3">
                                <p className="text-[10px] text-[#64748b] mb-1">Mode</p>
                                <p className="text-[16px] font-bold text-[#7170ff]">{status.mode}</p>
                            </div>
                            <div className="rounded-lg border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3">
                                <p className="text-[10px] text-[#64748b] mb-1">Confidence</p>
                                <p className="text-[16px] font-bold text-[#a371f7]">{status.config.confidence}%</p>
                            </div>
                            <div className="rounded-lg border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3">
                                <p className="text-[10px] text-[#64748b] mb-1">Reports</p>
                                <p className="text-[16px] font-bold text-[#22d3ee]">{status.report_count}</p>
                            </div>
                        </div>
                    </>
                )}
                {reports.length > 0 && (
                    <div className="rounded-lg border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-4">
                        <h3 className="text-[13px] font-semibold text-[#f7f8f8] mb-3">Guardian Reports</h3>
                        <div className="space-y-2">
                            {reports.slice(0, 10).map(r => (
                                <div key={r.id} className="p-3 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)]">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[12px] text-[#f7f8f8] font-medium">{r.title}</span>
                                        <span className={`text-[10px] ${r.result.status === "success" ? "text-emerald-400" : "text-amber-400"}`}>{r.result.status}</span>
                                    </div>
                                    <p className="text-[10px] text-[#64748b]">{r.namespace}/{r.target} · {r.action} · confidence {r.confidence}%</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {!status && !loading && (
                    <div className="text-center py-12">
                        <Shield className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
                        <p className="text-sm text-zinc-400">{error ? "Cannot reach service" : "Night Guardian status unavailable"}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
