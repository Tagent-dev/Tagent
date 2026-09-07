"use client";

import { useEffect, useState } from "react";
import { getIncidents, executeRemediation, type Incident } from "@/lib/api";

// ─── AI Incident Analysis Panel (matches reference image) ───────────────────

export function IncidentAnalysisPanel() {
    const [incident, setIncident] = useState<Incident | null>(null);
    const [remediating, setRemediating] = useState(false);
    const [remediationResult, setRemediationResult] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const res = await getIncidents().catch(() => ({ incidents: [], total: 0 }));
                // Pick the first active/critical incident
                const active = (res.incidents || []).find(i => i.status === "active" || i.status === "investigating") || (res.incidents || [])[0] || null;
                setIncident(active);
            } catch { }
        }
        load();
        const interval = setInterval(load, 15000);
        return () => clearInterval(interval);
    }, []);

    const title = incident?.title || "No active incidents";
    const severity = incident?.severity || "low";
    const confidence = incident?.confidence || 0;
    const rootCause = incident?.rootCause || "No root cause data available.";
    const blastRadius = incident?.blastRadius || [];
    const evidence = incident?.evidence || [];
    const startedAt = incident?.startedAt;

    const timeAgo = startedAt ? getTimeAgo(startedAt) : "—";

    const TIMELINE = evidence.length > 0
        ? evidence.map((e, i) => ({
            time: `${evidence.length - i}m ago`,
            event: e,
            subtitle: "",
            color: i === 0 ? "#f85149" : i < 3 ? "#f0883e" : "#3fb950",
            critical: i === 0,
        }))
        : [
            { time: timeAgo, event: title, subtitle: incident?.service || "", color: "#f85149", critical: true },
            { time: "Now", event: "AI analyzing...", subtitle: "", color: "#3fb950", critical: false },
        ];

    return (
        <div className="rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(15,23,42,0.10)]">
                <div className="flex items-center gap-2">
                    <h3 className="text-[14px] font-semibold text-[#f7f8f8]">AI Incident Analysis</h3>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider" style={{ background: severity === "critical" ? "rgba(248,81,73,0.15)" : "rgba(240,136,62,0.15)", color: severity === "critical" ? "#f85149" : "#f0883e", border: `1px solid ${severity === "critical" ? "rgba(248,81,73,0.4)" : "rgba(240,136,62,0.4)"}` }}>
                        {severity}
                    </span>
                </div>
                <span className="text-[10px] text-[#64748b] font-mono">
                    Incident ID: <span className="text-[#f7f8f8]">{incident?.id || "—"}</span>
                    <svg width="9" height="9" viewBox="0 0 12 12" fill="none" className="inline-block ml-1"><path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
            </div>

            {/* Incident headline + confidence */}
            <div className="px-4 py-3 flex items-center justify-between gap-4 border-b border-[rgba(15,23,42,0.10)]">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(248,81,73,0.15)", border: "1px solid rgba(248,81,73,0.4)" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f85149" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                    </div>
                    <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-[#f7f8f8]">{title}</p>
                        <p className="text-[11px] text-[#64748b] mt-0.5">Started {timeAgo} · Affecting {blastRadius.length || 1} service{blastRadius.length > 1 ? "s" : ""}</p>
                    </div>
                </div>
                <div className="text-right shrink-0">
                    <p className="text-[10px] text-[#64748b]">Confidence</p>
                    <p className="text-[18px] font-bold text-[#3fb950] font-mono leading-none">{confidence}%</p>
                    <div className="w-16 h-0.5 rounded-full bg-[rgba(15,23,42,0.10)] mt-1 overflow-hidden">
                        <div className="h-full rounded-full bg-[#3fb950]" style={{ width: `${confidence}%`, boxShadow: "0 0 4px #3fb950" }} />
                    </div>
                </div>
            </div>

            {/* Timeline + Root Cause (2 columns on wide) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border-b border-[rgba(15,23,42,0.10)]">
                {/* Incident Timeline */}
                <div>
                    <h4 className="text-[11px] font-semibold text-[#f7f8f8] mb-3">Incident Timeline</h4>
                    <div className="relative pl-1">
                        <div className="absolute left-[6px] top-1 bottom-1 w-px bg-[rgba(15,23,42,0.10)]" />
                        <div className="space-y-2.5">
                            {TIMELINE.map((t, i) => (
                                <div key={i} className="flex items-start gap-2.5 relative">
                                    <span className="w-3 h-3 rounded-full shrink-0 mt-0.5 relative z-10" style={{
                                        background: t.color,
                                        boxShadow: `0 0 6px ${t.color}`,
                                        animation: t.critical ? "wi-pulse 1.5s infinite" : undefined,
                                    }} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-[10px] text-[#64748b] font-mono">{t.time}</span>
                                        </div>
                                        <p className="text-[11px] font-medium" style={{ color: t.color }}>{t.event}</p>
                                        {t.subtitle && <p className="text-[10px] text-[#64748b]">{t.subtitle}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Root Cause + Radar */}
                <div>
                    <h4 className="text-[11px] font-semibold text-[#f7f8f8] mb-3">Root Cause Analysis</h4>
                    <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-[#64748b] leading-relaxed">
                                {rootCause}
                            </p>
                            <button className="mt-2 text-[11px] text-[#7170ff] hover:text-[#79c0ff] flex items-center gap-1">
                                View full analysis
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                    <polyline points="12 5 19 12 12 19" />
                                </svg>
                            </button>
                        </div>
                        <RadarVisual />
                    </div>
                </div>
            </div>

            {/* Blast Radius */}
            <div className="px-4 py-3 border-b border-[rgba(15,23,42,0.10)]">
                <h4 className="text-[11px] font-semibold text-[#f7f8f8] mb-3">Blast Radius</h4>
                <div className="grid grid-cols-[1fr_auto] gap-4 items-center">
                    <div className="grid grid-cols-3 gap-3">
                        <BlastStat value={String(blastRadius.length || 1)} label="Services Impacted" />
                        <BlastStat value={String(blastRadius.length > 0 ? blastRadius.length * 4 : 12)} label="Pods Affected" />
                        <BlastStat value="—" label="Requests/Min Affected" />
                    </div>
                    <BlastDots />
                </div>
            </div>

            {/* AI Recommendations */}
            <div className="px-4 py-3 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="#a371f7"><path d="M12 0L14 9L24 12L14 15L12 24L10 15L0 12L10 9Z" /></svg>
                        <h4 className="text-[12px] font-semibold text-[#f7f8f8]">AI Recommendations</h4>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: "rgba(63,185,80,0.15)", color: "#3fb950", border: "1px solid rgba(63,185,80,0.3)" }}>
                        Recommended
                    </span>
                </div>
                <div className="space-y-1">
                    <p className="text-[11px] text-[#f7f8f8]">{rootCause ? "Investigate root cause and apply fix." : "No recommendations available."}</p>
                </div>
                <div className="flex items-end justify-between gap-3 pt-1">
                    <button
                        onClick={async () => {
                            if (!incident) return;
                            const podName = incident.title.split(" ")[0] || incident.service;
                            const ns = incident.namespace || "default";
                            if (!confirm(`Restart pod "${podName}" in namespace "${ns}"?`)) return;
                            setRemediating(true);
                            setRemediationResult(null);
                            try {
                                const result = await executeRemediation({
                                    action: "restart-pod",
                                    namespace: ns,
                                    target: podName,
                                    dry_run: false,
                                });
                                setRemediationResult(result.status === "success" ? "✅ Pod restarted successfully" : `⚠️ ${result.message}`);
                            } catch (e: any) {
                                setRemediationResult(`❌ ${e.message}`);
                            } finally {
                                setRemediating(false);
                            }
                        }}
                        disabled={!incident || remediating}
                        className="flex-1 px-4 py-2 rounded-md text-[12px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                        style={{
                            background: "linear-gradient(135deg, #7170ff, #7c3aed)",
                            boxShadow: "0 0 12px rgba(124, 58, 237, 0.4)",
                        }}
                    >
                        {remediating ? "Applying..." : remediationResult || "Apply Remediation"}
                    </button>
                    <div className="text-right shrink-0">
                        <p className="text-[10px] text-[#64748b]">Confidence</p>
                        <p className="text-[14px] font-bold text-[#3fb950] font-mono leading-none">{confidence}%</p>
                        <div className="w-16 h-0.5 rounded-full bg-[rgba(15,23,42,0.10)] mt-1 overflow-hidden">
                            <div className="h-full rounded-full bg-[#3fb950]" style={{ width: `${confidence}%`, boxShadow: "0 0 4px #3fb950" }} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function getTimeAgo(iso: string): string {
    try {
        const diff = Date.now() - new Date(iso).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return "just now";
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    } catch {
        return "—";
    }
}

function BlastStat({ value, label }: { value: string; label: string }) {
    return (
        <div className="rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] px-2.5 py-2 text-center">
            <p className="text-[20px] font-bold text-[#f7f8f8] leading-none">{value}</p>
            <p className="text-[9px] text-[#64748b] mt-1 leading-tight">{label}</p>
        </div>
    );
}

// ─── Radar Visual ────────────────────────────────────────────────────────────

function RadarVisual() {
    return (
        <svg width="80" height="80" viewBox="0 0 80 80" className="shrink-0">
            <defs>
                <radialGradient id="radar-grad">
                    <stop offset="0%" stopColor="#f85149" stopOpacity="0.5" />
                    <stop offset="60%" stopColor="#f85149" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#f85149" stopOpacity="0" />
                </radialGradient>
            </defs>
            {[12, 22, 32].map((r, i) => (
                <circle key={i} cx="40" cy="40" r={r} fill="none" stroke="#f85149" strokeWidth="0.6" strokeOpacity={0.4 - i * 0.1} />
            ))}
            <line x1="8" y1="40" x2="72" y2="40" stroke="#f85149" strokeWidth="0.5" strokeOpacity="0.3" strokeDasharray="2 2" />
            <line x1="40" y1="8" x2="40" y2="72" stroke="#f85149" strokeWidth="0.5" strokeOpacity="0.3" strokeDasharray="2 2" />
            <circle cx="40" cy="40" r="32" fill="url(#radar-grad)" />
            <line x1="40" y1="40" x2="72" y2="40" stroke="#f85149" strokeWidth="1.2" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 3px #f85149)" }}>
                <animateTransform attributeName="transform" type="rotate" from="0 40 40" to="360 40 40" dur="3s" repeatCount="indefinite" />
            </line>
            <circle cx="40" cy="40" r="2.5" fill="#f85149" style={{ filter: "drop-shadow(0 0 4px #f85149)" }} />
            {[
                { x: 28, y: 32 }, { x: 50, y: 28 }, { x: 56, y: 48 }, { x: 32, y: 52 }, { x: 44, y: 56 }
            ].map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="1.5" fill="#f85149" opacity="0.8" style={{ filter: "drop-shadow(0 0 2px #f85149)" }} />
            ))}
        </svg>
    );
}

// ─── Blast Dots Visualization ────────────────────────────────────────────────

function BlastDots() {
    const dots: { x: number; y: number; r: number; color: string }[] = [];
    for (let i = 0; i < 80; i++) {
        const seed1 = (i * 9301 + 49297) % 233280 / 233280;
        const seed2 = (i * 1103 + 12345) % 65536 / 65536;
        const seed3 = (i * 8121 + 28411) % 134456 / 134456;
        const angle = seed1 * Math.PI * 2;
        const radius = Math.pow(seed2, 0.6) * 38;
        const x = 40 + radius * Math.cos(angle);
        const y = 40 + radius * Math.sin(angle);
        const isCenter = radius < 14;
        dots.push({
            x, y,
            r: seed3 * 1 + 0.6,
            color: isCenter ? "#f85149" : seed3 > 0.7 ? "#3fb950" : seed3 > 0.4 ? "#7170ff" : "#a371f7",
        });
    }
    return (
        <svg width="80" height="80" viewBox="0 0 80 80" className="shrink-0">
            {dots.map((d, i) => (
                <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={d.color} opacity={0.7} style={{ filter: `drop-shadow(0 0 2px ${d.color})` }} />
            ))}
            <circle cx="40" cy="40" r="3.5" fill="#f85149" style={{ filter: "drop-shadow(0 0 6px #f85149)" }} />
        </svg>
    );
}
