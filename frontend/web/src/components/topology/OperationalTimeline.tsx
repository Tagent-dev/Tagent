"use client";

import { useEffect, useState } from "react";
import { getRecentEvents, type StreamEvent } from "@/lib/api";

// ─── Operational Timeline (bottom-left) ──────────────────────────────────────

interface TimelineEvent {
    time: string;
    label: string;
    desc: string;
    color: string;
    icon: string;
    active?: boolean;
}

function deriveTimelineEvents(events: StreamEvent[]): TimelineEvent[] {
    if (events.length === 0) return [];
    return events.slice(0, 5).map((e, i) => {
        const time = new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
        const color = e.severity === "critical" || e.severity === "error" ? "#f85149"
            : e.severity === "warning" ? "#f0883e"
                : e.severity === "success" ? "#3fb950" : "#a371f7";
        const icon = e.severity === "critical" ? "alert" : e.severity === "warning" ? "search" : i === events.length - 1 ? "shield" : "check";
        return { time, label: e.title || e.type, desc: e.detail || e.source, color, icon, active: i === 0 };
    });
}

export function OperationalTimeline() {
    const [events, setEvents] = useState<TimelineEvent[]>([]);

    useEffect(() => {
        async function load() {
            try {
                const data = await getRecentEvents().catch(() => ({ events: [], total: 0 }));
                const derived = deriveTimelineEvents(data.events || []);
                setEvents(derived);
            } catch { }
        }
        load();
        const interval = setInterval(load, 15000);
        return () => clearInterval(interval);
    }, []);
    return (
        <div className="rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-4">
            {/* Header */}
            <div className="flex items-center gap-2.5 mb-4">
                <h3 className="text-[14px] font-semibold text-[#f7f8f8]">Operational Timeline</h3>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#3fb950]/10 border border-[#3fb950]/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950]" style={{ boxShadow: "0 0 6px #3fb950", animation: "wi-pulse 2s infinite" }} />
                    <span className="text-[10px] text-[#3fb950] font-semibold">Live</span>
                </div>
            </div>

            {/* Timeline bar */}
            <div className="relative mb-4">
                <div className="flex items-center justify-between text-[10px] text-[#94a3b8] font-mono mb-2">
                    {["12:31", "12:32", "12:33", "12:34", "12:35", "12:36", "12:37"].map(t => (
                        <span key={t} className={t === "12:35" ? "text-[#3fb950] font-bold text-[11px]" : ""}>{t}</span>
                    ))}
                </div>
                <div className="relative h-1.5 rounded-full bg-[rgba(15,23,42,0.10)] overflow-hidden">
                    <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: "70%", background: "linear-gradient(90deg, #f85149, #f0883e, #a371f7, #3fb950)", boxShadow: "0 0 6px rgba(63,185,80,0.4)" }} />
                </div>
                {/* Play button */}
                <button className="absolute right-0 top-0 w-6 h-6 rounded-full bg-[rgba(15,23,42,0.10)] border border-[rgba(15,23,42,0.14)] flex items-center justify-center text-[#64748b] hover:text-[#f7f8f8] transition-colors">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                </button>
            </div>

            {/* Event cards */}
            <div className="flex items-start gap-3 overflow-x-auto pb-1">
                {events.map((ev, i) => (
                    <div key={i} className={`shrink-0 w-[140px] rounded-md p-2.5 border ${ev.active ? "bg-[#3fb950]/5 border-[#3fb950]/30" : "bg-[rgba(255,255,255,0.02)] border-[rgba(15,23,42,0.10)]"}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                            <EventIcon icon={ev.icon} color={ev.color} />
                            <span className="text-[10px] font-semibold" style={{ color: ev.color }}>{ev.label}</span>
                        </div>
                        <p className="text-[9.5px] text-[#64748b] leading-snug">{ev.desc}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function EventIcon({ icon, color }: { icon: string; color: string }) {
    const props = { width: 12, height: 12, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 2.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
    if (icon === "alert") return (<svg {...props}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>);
    if (icon === "search") return (<svg {...props}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>);
    if (icon === "sparkle") return (<svg {...props} fill={color} stroke="none"><path d="M12 0L14 9L24 12L14 15L12 24L10 15L0 12L10 9Z" /></svg>);
    if (icon === "check") return (<svg {...props}><polyline points="20 6 9 17 4 12" /></svg>);
    // shield
    return (<svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></svg>);
}
