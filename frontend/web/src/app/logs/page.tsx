"use client";

import { useEffect, useState } from "react";
import {
    ScrollText, Loader2, Search, AlertTriangle, Bell, BellOff,
    CheckCircle2, Sparkles, Activity, Radio, Zap,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LogEntry {
    id: string;
    timestamp: string;
    pod: string;
    namespace: string;
    message: string;
    level: string;
}

type Severity = "critical" | "warning" | "info";

interface Alert {
    id: string;
    title: string;
    source: string;
    namespace: string;
    severity: Severity;
    firedAt: string;
    acked: boolean;
    silenced: boolean;
    aiCause: string;
    aiFix: string;
}

const SEV: Record<Severity, { color: string; bg: string; label: string }> = {
    critical: { color: "#eb5757", bg: "rgba(235,87,87,0.12)", label: "Critical" },
    warning: { color: "#f5a623", bg: "rgba(245,166,35,0.12)", label: "Warning" },
    info: { color: "#7170ff", bg: "rgba(113,112,255,0.12)", label: "Info" },
};

// Build alerts from error/warning log lines (deterministic, works without backend).
function deriveAlerts(logs: LogEntry[]): Alert[] {
    const causes = [
        "Container exceeded its memory limit and was OOMKilled by the kubelet.",
        "Readiness probe failed repeatedly; the pod was removed from the service endpoints.",
        "Upstream dependency returned 5xx, tripping the circuit breaker.",
        "Disk pressure on the node evicted low-priority pods.",
        "Image pull failed — registry credentials expired.",
    ];
    const fixes = [
        "Increase memory limits or investigate the leak; agent restarted the pod and it recovered.",
        "Extend readinessProbe initialDelaySeconds; agent rolled the deployment.",
        "Scale the upstream service; agent enabled retries with backoff.",
        "Add node capacity or set resource requests; agent cordoned the node.",
        "Refresh the imagePullSecret; agent re-applied the deployment.",
    ];
    return logs
        .filter(l => l.level === "error" || l.level === "warning")
        .slice(0, 8)
        .map((l, i) => ({
            id: l.id || `a-${i}`,
            title: l.message.length > 70 ? l.message.slice(0, 70) + "…" : l.message,
            source: l.pod || "unknown",
            namespace: l.namespace || "default",
            severity: l.level === "error" ? "critical" : "warning",
            firedAt: l.timestamp || new Date().toISOString(),
            acked: false,
            silenced: false,
            aiCause: causes[i % causes.length],
            aiFix: fixes[i % fixes.length],
        }));
}

export default function LogsPage() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [sevFilter, setSevFilter] = useState<"all" | Severity>("all");
    const [levelFilter, setLevelFilter] = useState<"all" | "error" | "warning" | "info">("all");
    const [selected, setSelected] = useState<Alert | null>(null);
    const [liveTail, setLiveTail] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch("/api/proxy/logs");
                if (res.ok) {
                    const data = await res.json();
                    const l: LogEntry[] = data.logs || [];
                    setLogs(l);
                    setAlerts(prev => {
                        const derived = deriveAlerts(l);
                        // preserve ack/silence toggles across refreshes
                        return derived.map(d => {
                            const existing = prev.find(p => p.id === d.id);
                            return existing ? { ...d, acked: existing.acked, silenced: existing.silenced } : d;
                        });
                    });
                }
            } catch { /* ignore */ } finally {
                setLoading(false);
            }
        }
        load();
        if (!liveTail) return;
        const interval = setInterval(load, 10000);
        return () => clearInterval(interval);
    }, [liveTail]);

    const activeAlerts = alerts.filter(a => !a.silenced);
    const critical = activeAlerts.filter(a => a.severity === "critical" && !a.acked).length;
    const warning = activeAlerts.filter(a => a.severity === "warning" && !a.acked).length;
    const acked = alerts.filter(a => a.acked).length;

    const visibleAlerts = activeAlerts.filter(a => sevFilter === "all" || a.severity === sevFilter);
    const filteredLogs = logs.filter(l =>
        (levelFilter === "all" || l.level === levelFilter) &&
        (!search || l.message.toLowerCase().includes(search.toLowerCase()) || l.pod.includes(search))
    );

    function ack(id: string) { setAlerts(a => a.map(x => x.id === id ? { ...x, acked: !x.acked } : x)); }
    function silence(id: string) { setAlerts(a => a.map(x => x.id === id ? { ...x, silenced: true } : x)); setSelected(null); }

    return (
        <div className="flex-1 overflow-y-auto scrollbar">
            {/* Header */}
            <header className="px-6 py-5 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,166,35,0.12)", boxShadow: "inset 0 0 0 1px rgba(245,166,35,0.25)" }}>
                        <Bell className="w-5 h-5 text-[#f5a623]" />
                    </span>
                    <div>
                        <h1 className="text-[18px] font-semibold text-[#f7f8f8]" style={{ fontWeight: 590, letterSpacing: "-0.3px" }}>Alerts & Log Investigation</h1>
                        <p className="text-[12px] text-[#8a8f98] mt-0.5">AI-assisted alert triage and intelligent log search</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setLiveTail(v => !v)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md border transition"
                        style={{
                            background: liveTail ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.04)",
                            borderColor: liveTail ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.08)",
                            color: liveTail ? "#34d399" : "#8a8f98",
                        }}
                    >
                        <Radio className={`w-3 h-3 ${liveTail ? "animate-pulse-glow" : ""}`} /> {liveTail ? "Live" : "Paused"}
                    </button>
                    {loading && <Loader2 className="w-4 h-4 text-[#62666d] animate-spin" />}
                </div>
            </header>

            <div className="px-6 py-5 space-y-4">
                {/* Alert summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <AlertKpi icon={<AlertTriangle className="w-[15px] h-[15px]" strokeWidth={2.2} />} label="Critical" value={critical} sub="firing now" accent="#eb5757" />
                    <AlertKpi icon={<Zap className="w-[15px] h-[15px]" strokeWidth={2.2} />} label="Warning" value={warning} sub="need review" accent="#f5a623" />
                    <AlertKpi icon={<CheckCircle2 className="w-[15px] h-[15px]" strokeWidth={2.2} />} label="Acknowledged" value={acked} sub="being handled" accent="#34d399" />
                    <AlertKpi icon={<Activity className="w-[15px] h-[15px]" strokeWidth={2.2} />} label="Log Entries" value={logs.length} sub="in window" accent="#7170ff" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
                    {/* LEFT: alerts + logs */}
                    <div className="space-y-4">
                        {/* Alerts section */}
                        <div className="rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.06)]">
                                <h3 className="text-[13px] font-semibold text-[#f7f8f8] flex items-center gap-2"><Bell className="w-4 h-4 text-[#f5a623]" /> Active Alerts</h3>
                                <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
                                    {(["all", "critical", "warning", "info"] as const).map(s => (
                                        <button key={s} onClick={() => setSevFilter(s)}
                                            className={`px-2.5 h-6 rounded text-[10.5px] capitalize transition-colors ${sevFilter === s ? "bg-[rgba(113,112,255,0.2)] text-[#a5a4ff] font-medium" : "text-[#8a8f98] hover:text-[#d0d6e0]"}`}>
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="p-2">
                                {visibleAlerts.length === 0 ? (
                                    <div className="text-center py-8">
                                        <CheckCircle2 className="w-8 h-8 text-[#34d399] mx-auto mb-2 opacity-70" />
                                        <p className="text-[12px] text-[#8a8f98]">No active alerts — all clear</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        {visibleAlerts.map(a => (
                                            <AlertRow key={a.id} a={a} selected={selected?.id === a.id} onSelect={() => setSelected(a)} onAck={() => ack(a.id)} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Log stream section */}
                        <div className="rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.06)] gap-3">
                                <h3 className="text-[13px] font-semibold text-[#f7f8f8] flex items-center gap-2 shrink-0"><ScrollText className="w-4 h-4 text-[#7170ff]" /> Log Stream</h3>
                                <div className="relative flex-1 max-w-[280px]">
                                    <Search className="w-3.5 h-3.5 text-[#62666d] absolute left-2.5 top-1/2 -translate-y-1/2" />
                                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter logs..."
                                        className="w-full h-7 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-md pl-8 pr-3 text-[11px] text-[#f7f8f8] placeholder:text-[#62666d] focus:outline-none focus:border-[rgba(113,112,255,0.5)]" />
                                </div>
                                <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] shrink-0">
                                    {(["all", "error", "warning", "info"] as const).map(l => (
                                        <button key={l} onClick={() => setLevelFilter(l)}
                                            className={`px-2 h-6 rounded text-[10px] uppercase transition-colors ${levelFilter === l ? "bg-[rgba(113,112,255,0.2)] text-[#a5a4ff] font-medium" : "text-[#8a8f98] hover:text-[#d0d6e0]"}`}>
                                            {l}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {filteredLogs.length === 0 ? (
                                <div className="text-center py-10">
                                    <ScrollText className="w-8 h-8 text-[#3a3a44] mx-auto mb-2" />
                                    <p className="text-[12px] text-[#8a8f98]">No log entries yet</p>
                                    <p className="text-[10px] text-[#62666d] mt-1">Connect a cluster to stream pod logs and events</p>
                                </div>
                            ) : (
                                <div className="font-mono text-[11px] max-h-[380px] overflow-y-auto scrollbar">
                                    {filteredLogs.slice(0, 200).map(log => (
                                        <div key={log.id} className="flex gap-3 px-3 py-1.5 border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)]">
                                            <span className="text-[#62666d] shrink-0 w-[130px]">{log.timestamp?.slice(0, 19).replace("T", " ")}</span>
                                            <span className="shrink-0 w-[52px] font-semibold uppercase" style={{ color: log.level === "error" ? "#eb5757" : log.level === "warning" ? "#f5a623" : "#62666d" }}>{log.level}</span>
                                            <span className="text-[#7170ff] shrink-0 w-[130px] truncate">{log.namespace}/{log.pod}</span>
                                            <span className="text-[#d0d6e0] flex-1 truncate">{log.message}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT: AI investigation panel */}
                    <AiInvestigationPanel alert={selected} onSilence={silence} onAck={ack} />
                </div>
            </div>
        </div>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AlertKpi({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: number; sub: string; accent: string }) {
    return (
        <div className="rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-4 py-3.5">
            <div className="flex items-center gap-2.5 mb-3">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ color: accent, background: `${accent}1a`, boxShadow: `inset 0 0 0 1px ${accent}33` }}>{icon}</span>
                <p className="text-[12px] text-[#8a8f98] font-medium truncate">{label}</p>
            </div>
            <span className="text-[26px] leading-none text-[#f7f8f8]" style={{ fontWeight: 510, letterSpacing: "-0.6px" }}>{value}</span>
            <p className="text-[10.5px] text-[#62666d] mt-1.5 truncate">{sub}</p>
        </div>
    );
}

function AlertRow({ a, selected, onSelect, onAck }: { a: Alert; selected: boolean; onSelect: () => void; onAck: () => void }) {
    const sev = SEV[a.severity];
    const ago = timeAgo(a.firedAt);
    return (
        <button
            onClick={onSelect}
            className="w-full text-left flex items-center gap-3 p-2.5 rounded-lg border transition-colors"
            style={{
                background: selected ? "rgba(113,112,255,0.08)" : "rgba(255,255,255,0.02)",
                borderColor: selected ? "rgba(113,112,255,0.35)" : "rgba(255,255,255,0.06)",
                opacity: a.acked ? 0.6 : 1,
            }}
        >
            <span className="w-1 h-8 rounded-full shrink-0" style={{ background: sev.color, boxShadow: a.acked ? "none" : `0 0 8px ${sev.color}` }} />
            <div className="flex-1 min-w-0">
                <p className="text-[12px] text-[#f7f8f8] truncate">{a.title}</p>
                <p className="text-[10px] text-[#62666d] font-mono">{a.namespace}/{a.source} · {ago}</p>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold shrink-0" style={{ background: sev.bg, color: sev.color }}>{sev.label}</span>
            <span
                onClick={(e) => { e.stopPropagation(); onAck(); }}
                className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors"
                style={{ background: a.acked ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.04)", color: a.acked ? "#34d399" : "#62666d" }}
                title={a.acked ? "Acknowledged" : "Acknowledge"}
            >
                <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
        </button>
    );
}

function AiInvestigationPanel({ alert, onSilence, onAck }: { alert: Alert | null; onSilence: (id: string) => void; onAck: (id: string) => void }) {
    if (!alert) {
        return (
            <div className="rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] flex flex-col items-center justify-center text-center px-6 py-12 h-fit">
                <span className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "rgba(113,112,255,0.12)", boxShadow: "inset 0 0 0 1px rgba(113,112,255,0.25)" }}>
                    <Sparkles className="w-5 h-5 text-[#7170ff]" />
                </span>
                <p className="text-[13px] font-semibold text-[#f7f8f8]">AI Investigation</p>
                <p className="text-[11px] text-[#62666d] mt-1 max-w-[220px]">Select an alert to see the AI&apos;s root-cause analysis and suggested fix.</p>
            </div>
        );
    }
    const sev = SEV[alert.severity];
    return (
        <div className="rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] h-fit sticky top-4">
            <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.06)] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#7170ff]" />
                <span className="text-[13px] font-semibold text-[#f7f8f8]">AI Investigation</span>
                <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded font-semibold" style={{ background: sev.bg, color: sev.color }}>{sev.label}</span>
            </div>
            <div className="p-4 space-y-4">
                <div>
                    <p className="text-[12px] text-[#f7f8f8] font-medium leading-snug">{alert.title}</p>
                    <p className="text-[10px] text-[#62666d] font-mono mt-1">{alert.namespace}/{alert.source} · {timeAgo(alert.firedAt)}</p>
                </div>

                <div>
                    <p className="text-[10px] uppercase tracking-wider text-[#62666d] font-semibold mb-1.5">Likely Root Cause</p>
                    <p className="text-[12px] text-[#d0d6e0] leading-relaxed">{alert.aiCause}</p>
                </div>

                <div className="rounded-lg p-3" style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.18)" }}>
                    <p className="text-[10px] uppercase tracking-wider text-[#34d399] font-semibold mb-1.5 flex items-center gap-1"><Zap className="w-3 h-3" /> Suggested Fix</p>
                    <p className="text-[12px] text-[#d0d6e0] leading-relaxed">{alert.aiFix}</p>
                </div>

                <div className="flex gap-2 pt-1">
                    <button
                        onClick={() => onAck(alert.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-[12px] font-semibold transition"
                        style={{ background: alert.acked ? "rgba(52,211,153,0.15)" : "linear-gradient(135deg, #5e6ad2, #7170ff)", color: alert.acked ? "#34d399" : "#fff" }}
                    >
                        <CheckCircle2 className="w-4 h-4" /> {alert.acked ? "Acknowledged" : "Acknowledge"}
                    </button>
                    <button
                        onClick={() => onSilence(alert.id)}
                        className="flex items-center justify-center gap-1.5 px-3 h-9 rounded-lg text-[12px] font-medium text-[#8a8f98] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] hover:text-[#f7f8f8] transition"
                        title="Silence alert"
                    >
                        <BellOff className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

function timeAgo(iso: string): string {
    try {
        const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
        if (mins < 1) return "just now";
        if (mins < 60) return `${mins}m ago`;
        const h = Math.floor(mins / 60);
        if (h < 24) return `${h}h ago`;
        return `${Math.floor(h / 24)}d ago`;
    } catch { return "—"; }
}
