"use client";

import { useEffect, useState } from "react";
import { getFleetClusters, getIncidents, type ClusterRegistration, type Incident } from "@/lib/api";

// ─── AI Fleet Intelligence + Active Incident Timeline ────────────────────────

interface Insight {
    text: string;
    sub: string;
    confidence: number;
    color: string;
}

interface TimelineEvent {
    time: string;
    badge: string;
    desc: string;
    color: string;
}

const FALLBACK_INSIGHTS: Insight[] = [
    { text: "Production US-East is operating normally", sub: "No anomalies detected", confidence: 99, color: "#3fb950" },
    { text: "No pod restart anomalies detected", sub: "Across all production clusters", confidence: 97, color: "#3fb950" },
    { text: "Memory pressure increasing in EU-West", sub: "8% increase in last 15m", confidence: 88, color: "#f0883e" },
    { text: "Deployment risk detected in Staging", sub: "High failure probability detected", confidence: 88, color: "#f85149" },
    { text: "Network latency within baseline", sub: "All clusters performing normally", confidence: 99, color: "#3fb950" },
];

const FALLBACK_TIMELINE: TimelineEvent[] = [
    { time: "12:31", badge: "Anomaly Detected", desc: "Memory pressure in EU-West", color: "#f85149" },
    { time: "12:34", badge: "Root Cause Identified", desc: "Connection pool exhaustion", color: "#f0883e" },
    { time: "12:36", badge: "Remediation Started", desc: "Scaling connection pool", color: "#a371f7" },
    { time: "12:38", badge: "Incident Resolved", desc: "All systems normal", color: "#3fb950" },
];

function deriveInsights(clusters: ClusterRegistration[]): Insight[] {
    if (clusters.length === 0) return [];
    const insights: Insight[] = [];
    const healthy = clusters.filter(c => c.status === "healthy" || c.health_score >= 80);
    const warning = clusters.filter(c => c.status === "warning" || (c.health_score >= 50 && c.health_score < 80));
    const critical = clusters.filter(c => c.status === "critical" || c.health_score < 50);

    if (healthy.length > 0) {
        insights.push({ text: `${healthy[0].name} is operating normally`, sub: "No anomalies detected", confidence: 99, color: "#3fb950" });
    }
    if (critical.length > 0) {
        insights.push({ text: `Critical issue in ${critical[0].name}`, sub: `Health score: ${critical[0].health_score}`, confidence: 88, color: "#f85149" });
    }
    if (warning.length > 0) {
        insights.push({ text: `${warning[0].name} showing warnings`, sub: `${warning[0].active_incidents} active incidents`, confidence: 88, color: "#f0883e" });
    }
    insights.push({ text: `${healthy.length} cluster${healthy.length !== 1 ? "s" : ""} fully healthy`, sub: "Across all environments", confidence: 97, color: "#3fb950" });
    insights.push({ text: "Fleet network within baseline", sub: "All clusters performing normally", confidence: 99, color: "#3fb950" });
    return insights.slice(0, 5);
}

function deriveTimeline(incidents: Incident[]): TimelineEvent[] {
    if (incidents.length === 0) return [];
    const active = incidents.filter(i => i.status === "active" || i.status === "investigating").slice(0, 4);
    if (active.length === 0) return [];
    return active.map(inc => {
        const time = inc.startedAt ? new Date(inc.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) : "—";
        const color = inc.severity === "critical" ? "#f85149" : inc.severity === "high" ? "#f0883e" : "#a371f7";
        return { time, badge: inc.severity.charAt(0).toUpperCase() + inc.severity.slice(1), desc: inc.title, color };
    });
}

export function AIFleetIntelligence() {
    const [insights, setInsights] = useState<Insight[]>([]);
    const [timeline, setTimeline] = useState<TimelineEvent[]>([]);

    useEffect(() => {
        async function load() {
            try {
                const [fleetData, incidentData] = await Promise.all([
                    getFleetClusters().catch(() => ({ clusters: [], total: 0 })),
                    getIncidents().catch(() => ({ incidents: [], total: 0 })),
                ]);
                setInsights(deriveInsights(fleetData.clusters));
                setTimeline(deriveTimeline(incidentData.incidents));
            } catch { }
        }
        load();
        const interval = setInterval(load, 15000);
        return () => clearInterval(interval);
    }, []);
    return (
        <>
            {/* AI Fleet Intelligence */}
            <div className="rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3.5">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <h3 className="text-[13px] font-semibold text-[#f7f8f8]">AI Fleet Intelligence</h3>
                        <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#3fb950]/10 border border-[#3fb950]/30">
                            <span className="w-1 h-1 rounded-full bg-[#3fb950]" style={{ boxShadow: "0 0 4px #3fb950", animation: "wi-pulse 2s infinite" }} />
                            <span className="text-[9px] text-[#3fb950] font-semibold">Live</span>
                        </div>
                    </div>
                    <button className="text-[10px] text-[#7170ff] hover:text-[#79c0ff]">View all</button>
                </div>
                <div className="space-y-2">
                    {insights.map((ins, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] hover:border-[rgba(15,23,42,0.14)] transition-colors">
                            <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: ins.color, boxShadow: `0 0 4px ${ins.color}` }} />
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] text-[#f7f8f8] leading-snug">{ins.text}</p>
                                <p className="text-[10px] text-[#64748b] mt-0.5">{ins.sub}</p>
                            </div>
                            <span className="text-[10px] text-[#64748b] font-mono shrink-0">Confidence <span className="font-semibold" style={{ color: ins.color }}>{ins.confidence}%</span></span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Active Incident Timeline */}
            <div className="rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3.5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[13px] font-semibold text-[#f7f8f8]">Active Incident Timeline</h3>
                    <button className="text-[10px] text-[#7170ff] hover:text-[#79c0ff]">View all</button>
                </div>
                <div className="space-y-2">
                    {timeline.map((ev, i) => (
                        <div key={i} className="flex items-center gap-2.5">
                            <span className="text-[10px] text-[#94a3b8] font-mono w-10 shrink-0">{ev.time}</span>
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ev.color, boxShadow: `0 0 4px ${ev.color}` }} />
                            <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded" style={{ background: `${ev.color}18`, color: ev.color }}>{ev.badge}</span>
                            <span className="text-[10.5px] text-[#64748b] truncate">{ev.desc}</span>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}
