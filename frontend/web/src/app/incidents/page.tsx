"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getIncidents, type Incident } from "@/lib/api";
import { AlertTriangle, Loader2, WifiOff, CheckCircle } from "lucide-react";

export default function IncidentsPage() {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const data = await getIncidents();
                setIncidents(data.incidents || []);
                setError(null);
            } catch (e: any) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        }
        load();
        const interval = setInterval(load, 10000);
        return () => clearInterval(interval);
    }, []);

    const active = incidents.filter(i => i.status !== "resolved");
    const resolved = incidents.filter(i => i.status === "resolved");

    return (
        <div className="flex-1 overflow-y-auto scrollbar bg-[rgba(255,255,255,0.02)]">
            <header className="px-6 py-5 border-b border-zinc-800/60">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-semibold text-zinc-100">Incidents</h1>
                        <p className="text-sm text-zinc-500 mt-0.5">{incidents.length} total · {active.length} active</p>
                    </div>
                    {loading && <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />}
                    {error && <WifiOff className="w-4 h-4 text-amber-400" />}
                </div>
            </header>

            <div className="px-6 py-5 space-y-3">
                {/* Stats */}
                {incidents.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <StatCard label="Active" value={active.length} color={active.length > 0 ? "#f85149" : "#3fb950"} />
                        <StatCard label="Critical" value={incidents.filter(i => i.severity === "critical").length} color="#f85149" />
                        <StatCard label="High" value={incidents.filter(i => i.severity === "high").length} color="#f0883e" />
                        <StatCard label="Resolved" value={resolved.length} color="#3fb950" />
                    </div>
                )}

                {/* No incidents */}
                {incidents.length === 0 && !loading && (
                    <div className="text-center py-12">
                        <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
                        <p className="text-sm text-emerald-400 font-medium">All Clear</p>
                        <p className="text-[11px] text-zinc-500 mt-1">{error ? "Cannot reach monitoring service" : "No incidents detected in your cluster"}</p>
                    </div>
                )}

                {/* Incident list */}
                {incidents.map(inc => (
                    <Link key={inc.id} href={`/incidents/${inc.id}`} className="block">
                        <div className="rounded-lg bg-zinc-900/50 border border-zinc-800 p-4 hover:border-zinc-700 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${inc.severity === "critical" ? "bg-red-500/10 text-red-400" : inc.severity === "high" ? "bg-orange-500/10 text-orange-400" : inc.severity === "medium" ? "bg-amber-500/10 text-amber-400" : "bg-blue-500/10 text-blue-400"}`}>{inc.severity}</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${inc.status === "resolved" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>{inc.status}</span>
                                </div>
                                <span className="text-[10px] text-zinc-500 font-mono">{inc.id}</span>
                            </div>
                            <p className="text-[13px] text-zinc-200 font-medium">{inc.title}</p>
                            <p className="text-[11px] text-zinc-500 mt-1">{inc.namespace}/{inc.service}</p>
                            {inc.rootCause && (
                                <p className="text-[11px] text-zinc-400 mt-2 border-l-2 border-amber-500/40 pl-2">{inc.rootCause}</p>
                            )}
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="rounded-lg border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3">
            <p className="text-[10px] text-[#64748b] mb-1">{label}</p>
            <p className="text-[20px] font-bold font-mono" style={{ color }}>{value}</p>
        </div>
    );
}
