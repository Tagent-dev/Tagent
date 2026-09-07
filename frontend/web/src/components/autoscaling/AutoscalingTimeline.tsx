"use client";

import { useEffect, useState } from "react";
import { getRecentEvents } from "@/lib/api";

// ─── Autoscaling Timeline (horizontal with large circle icons) ───────────────

const EVENTS = [
    { time: "10:21 AM", line1: "Scaling Event", line2: "Detected", color: "#3fb950" },
    { time: "10:21 AM", line1: "CPU Threshold", line2: "Exceeded", color: "#f0883e" },
    { time: "10:22 AM", line1: "AI Recommendation", line2: "Generated", color: "#a371f7" },
    { time: "10:22 AM", line1: "Scale Action", line2: "Executed", color: "#7170ff" },
    { time: "10:23 AM", line1: "Workload", line2: "Stabilized", color: "#3fb950" },
];

type TimelineEvent = typeof EVENTS[number];

const SEVERITY_COLORS: Record<string, string> = {
    critical: "#f85149",
    high: "#f0883e",
    warning: "#f0883e",
    medium: "#a371f7",
    low: "#7170ff",
    info: "#3fb950",
};

function mapEventsToTimeline(
    apiEvents: Array<{ type: string; title: string; detail: string; severity: string; timestamp: string }>
): TimelineEvent[] {
    return apiEvents.slice(0, 5).map((ev) => {
        const date = new Date(ev.timestamp);
        const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase();
        const words = ev.title.split(" ");
        const mid = Math.ceil(words.length / 2);
        const line1 = words.slice(0, mid).join(" ");
        const line2 = words.slice(mid).join(" ") || ev.type;
        const color = SEVERITY_COLORS[ev.severity] || "#3fb950";
        return { time, line1, line2, color };
    });
}

export function AutoscalingTimeline() {
    const [events, setEvents] = useState<TimelineEvent[]>([]);

    useEffect(() => {
        function load() {
            Promise.all([
                getRecentEvents().catch(() => null),
            ]).then(([eventsData]) => {
                const apiEvents = eventsData?.events || [];
                if (apiEvents.length > 0) {
                    const mapped = mapEventsToTimeline(apiEvents);
                    if (mapped.length > 0) setEvents(mapped);
                }
            });
        }
        load();
        const interval = setInterval(load, 15000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5">
                    <h3 className="text-[14px] font-semibold text-[#f7f8f8]">Autoscaling Timeline</h3>
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#3fb950]/10 border border-[#3fb950]/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950]" style={{ boxShadow: "0 0 6px #3fb950", animation: "wi-pulse 2s infinite" }} />
                        <span className="text-[10px] text-[#3fb950] font-semibold">Live</span>
                    </div>
                </div>
                <button className="text-[11px] text-[#64748b] px-2.5 py-1 rounded-md border border-[rgba(15,23,42,0.14)] hover:text-[#f7f8f8] hover:border-[rgba(15,23,42,0.20)] transition-colors">
                    View all
                </button>
            </div>

            {/* Timeline */}
            <div className="relative flex items-start justify-between px-4">
                {/* Connecting line (behind circles) */}
                <div
                    className="absolute top-[28px] left-[60px] right-[60px] h-[2px] rounded-full"
                    style={{
                        background: "linear-gradient(90deg, #3fb950, #f0883e, #a371f7, #7170ff, #3fb950)",
                        boxShadow: "0 0 6px rgba(88,166,255,0.3)",
                    }}
                />

                {/* Event nodes */}
                {events.map((ev, i) => (
                    <div key={i} className="flex flex-col items-center relative z-10" style={{ width: "18%" }}>
                        {/* Circle with hexagonal icon */}
                        <div
                            className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
                            style={{
                                background: `${ev.color}12`,
                                border: `2.5px solid ${ev.color}`,
                                boxShadow: `0 0 12px ${ev.color}40, inset 0 0 8px ${ev.color}10`,
                            }}
                        >
                            {/* Hexagonal badge with cube icon */}
                            <svg width="28" height="28" viewBox="0 0 32 32">
                                <polygon
                                    points="16,2 28,9 28,23 16,30 4,23 4,9"
                                    fill={`${ev.color}20`}
                                    stroke={ev.color}
                                    strokeWidth="1.2"
                                    strokeOpacity="0.8"
                                />
                                <g transform="translate(16, 16)" style={{ filter: `drop-shadow(0 0 3px ${ev.color})` }}>
                                    <path d="M0,-6 L6,-3 L0,0 L-6,-3 Z" fill={ev.color} fillOpacity="0.6" stroke={ev.color} strokeWidth="0.5" strokeLinejoin="round" />
                                    <path d="M-6,-3 L0,0 L0,6 L-6,3 Z" fill={ev.color} fillOpacity="0.25" stroke={ev.color} strokeWidth="0.5" strokeLinejoin="round" />
                                    <path d="M6,-3 L0,0 L0,6 L6,3 Z" fill={ev.color} fillOpacity="0.4" stroke={ev.color} strokeWidth="0.5" strokeLinejoin="round" />
                                </g>
                            </svg>
                        </div>

                        {/* Time */}
                        <p className="text-[11px] text-[#64748b] font-mono mb-1">{ev.time}</p>
                        {/* Label (2 lines) */}
                        <p className="text-[11px] text-[#f7f8f8] font-medium text-center leading-tight">{ev.line1}</p>
                        <p className="text-[11px] text-[#f7f8f8] font-medium text-center leading-tight">{ev.line2}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
