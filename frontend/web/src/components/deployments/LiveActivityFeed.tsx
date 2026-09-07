"use client";

import { useEffect, useState } from "react";
import { getRecentEvents, StreamEvent } from "@/lib/api";

interface Activity {
    action: string;
    desc: string;
    time: string;
    color: string;
}

function formatRelativeTime(timestamp: string): string {
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diffMs = now - then;
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
}

function severityToColor(severity: string): string {
    const s = severity.toLowerCase();
    if (s === "critical" || s === "error") return "#f85149";
    if (s === "warning") return "#f0883e";
    return "#3fb950";
}

function mapEventToActivity(event: StreamEvent): Activity {
    return {
        action: event.title,
        desc: event.detail,
        time: formatRelativeTime(event.timestamp),
        color: severityToColor(event.severity),
    };
}

export function LiveActivityFeed() {
    const [activities, setActivities] = useState<Activity[] | null>(null);

    useEffect(() => {
        function fetchData() {
            getRecentEvents()
                .then((data) => setActivities(data.events.map(mapEventToActivity)))
                .catch(() => setActivities([]));
        }
        fetchData();
        const interval = setInterval(fetchData, 15000);
        return () => clearInterval(interval);
    }, []);

    const items = activities ?? [];

    return (
        <div className="rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3.5">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <h3 className="text-[13px] font-semibold text-[#f7f8f8]">Live Activity Feed</h3>
                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#3fb950]/10 border border-[#3fb950]/30">
                        <span className="w-1 h-1 rounded-full bg-[#3fb950]" style={{ boxShadow: "0 0 4px #3fb950", animation: "wi-pulse 2s infinite" }} />
                        <span className="text-[9px] text-[#3fb950] font-semibold">Live</span>
                    </div>
                </div>
                <button className="text-[10px] text-[#7170ff] hover:text-[#79c0ff]">View all</button>
            </div>

            <div className="space-y-2">
                {activities === null && (
                    <div className="py-4 text-center">
                        <p className="text-[11px] text-[#64748b]">—</p>
                    </div>
                )}
                {activities !== null && items.length === 0 && (
                    <div className="py-4 text-center">
                        <p className="text-[11px] text-[#64748b]">No recent activity</p>
                    </div>
                )}
                {items.map((a, i) => (
                    <div key={i} className="flex items-start gap-2 py-1.5 border-b border-[rgba(15,23,42,0.10)] last:border-0">
                        <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: a.color, boxShadow: `0 0 3px ${a.color}` }} />
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold" style={{ color: a.color }}>{a.action}</p>
                            <p className="text-[10px] text-[#64748b] truncate">{a.desc}</p>
                        </div>
                        <span className="text-[9px] text-[#94a3b8] font-mono shrink-0">{a.time}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
