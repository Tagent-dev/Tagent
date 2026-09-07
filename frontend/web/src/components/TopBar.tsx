"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Search, Bell, Radio, ChevronDown, Clock } from "lucide-react";
import { getAdminInfo, getClusterInfo } from "@/lib/api";

const pageTitles: Record<string, { title: string; description: string; aiBadge?: boolean }> = {
    "/": { title: "Dashboard", description: "AI-powered Kubernetes incident intelligence, operational insights, and autonomous remediation." },
    "/incidents": { title: "Incident Intelligence", description: "AI-powered analysis, root cause detection, and automated remediation for Kubernetes environments." },
    "/clusters": { title: "Cluster Intelligence Center", description: "Real-time Kubernetes fleet visibility, AI health analysis, incident intelligence, and autonomous operations.", aiBadge: false },
    "/topology": { title: "Service Graph", description: "Live service relationships, AI analysis, failure propagation, and operational health.", aiBadge: false },
    "/ai": { title: "Tagent AI", description: "Your Kubernetes assistant with real-time infrastructure awareness." },
    "/metrics": { title: "Metrics Intelligence", description: "Correlating telemetry, identifying patterns, and predicting outcomes." },
    "/remediation": { title: "AI Remediation Center", description: "AI-powered recovery and autonomous remediation for Kubernetes infrastructure." },
    "/night-guardian": { title: "Night Guardian — Autonomous Protection", description: "Watching 47 services · Monitoring 312 pods · Last analysis 12 seconds ago" },
    "/nodes": { title: "Infrastructure Compute Layer", description: "Real-time Kubernetes node telemetry, AI health analysis, and workload intelligence." },
    "/pods": { title: "Workload Intelligence", description: "Real-time Kubernetes workload health, AI analysis, and operational insights.", aiBadge: true },
    "/deployments": { title: "Deployment Intelligence", description: "Real-time rollout visibility, workload health analysis, AI deployment risk detection, and operational intelligence.", aiBadge: true },
    "/autoscaling": { title: "Autonomous Scaling Intelligence", description: "Real-time workload elasticity, predictive scaling analysis, capacity forecasting, and AI optimization." },
    "/cost": { title: "Cloud Cost Intelligence", description: "Real-time Kubernetes cost visibility, AI optimization insights, resource efficiency analysis, and infrastructure forecasting." },
    "/logs": { title: "Log Investigation", description: "AI-assisted log analysis and intelligent incident investigation." },
    "/risks": { title: "Infrastructure Risk Intelligence", description: "Predicting operational failures before they impact production." },
    "/briefing": { title: "Video Briefing", description: "AI-generated incident video summaries." },
    "/knowledge": { title: "Knowledge", description: "Operational knowledge base and runbooks." },
    "/reports": { title: "AI Incident Knowledge Center", description: "AI-generated postmortems, learnings and operational intelligence from every incident." },
    "/audit": { title: "Audit Log", description: "System activity and change tracking." },
    "/settings": { title: "Settings", description: "Platform configuration and preferences." },
    "/integrations": { title: "Integrations Command Center", description: "Configure, test and manage all your notification and escalation integrations." },
    "/admin/users": { title: "User Management", description: "Create and manage team members who can access this dashboard." },
};

export function TopBar() {
    const pathname = usePathname();
    const page = pageTitles[pathname] || pageTitles["/"];
    const [notifOpen, setNotifOpen] = useState(false);
    const [adminInitial, setAdminInitial] = useState("A");
    const [clusterName, setClusterName] = useState("—");
    const [environment, setEnvironment] = useState("—");
    const [notifications, setNotifications] = useState<Array<{ title: string; sub: string; time: string; color: string; unread: boolean }>>([]);
    const [timeRange, setTimeRange] = useState("Last 15m");
    const [timeOpen, setTimeOpen] = useState(false);

    // Fetch admin info for cluster/environment display
    useEffect(() => {
        // Auto-detect cluster info from K8s (always works, no setup needed)
        getClusterInfo()
            .then(info => {
                if (info.cluster_name) setClusterName(info.cluster_name);
                if (info.environment) setEnvironment(info.environment);
            })
            .catch(() => { });

        // Try admin info for avatar name
        getAdminInfo()
            .then(info => {
                if (info.name) setAdminInitial(info.name.charAt(0).toUpperCase());
                // Override with admin-configured values if set
                if (info.cluster_name) setClusterName(info.cluster_name);
                if (info.role) setEnvironment(info.role);
            })
            .catch(() => {
                const data = localStorage.getItem("tagent_admin");
                if (data) {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.name) setAdminInitial(parsed.name.charAt(0).toUpperCase());
                    } catch { /* ignore */ }
                }
            });

        // Fetch notifications from real events/incidents
        Promise.all([
            import("@/lib/api").then(m => m.getRecentEvents()).catch(() => ({ events: [], total: 0 })),
            import("@/lib/api").then(m => m.getIncidents()).catch(() => ({ incidents: [], total: 0 })),
        ]).then(([eventsData, incidentsData]) => {
            const notifs: Array<{ title: string; sub: string; time: string; color: string; unread: boolean }> = [];
            for (const inc of (incidentsData.incidents || []).slice(0, 5)) {
                const color = inc.severity === "critical" ? "#f85149" : inc.severity === "high" ? "#f0883e" : "#a371f7";
                const diff = Date.now() - new Date(inc.startedAt).getTime();
                const mins = Math.floor(diff / 60000);
                const ago = mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`;
                notifs.push({ title: `${inc.severity.charAt(0).toUpperCase() + inc.severity.slice(1)}: ${inc.title}`, sub: inc.rootCause || inc.service, time: ago, color, unread: inc.status === "active" });
            }
            for (const ev of (eventsData.events || []).slice(0, 7)) {
                const color = ev.severity === "critical" ? "#f85149" : ev.severity === "warning" ? "#f0883e" : ev.severity === "success" ? "#3fb950" : "#7170ff";
                const diff = Date.now() - new Date(ev.timestamp).getTime();
                const mins = Math.floor(diff / 60000);
                const ago = mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`;
                notifs.push({ title: ev.title || ev.type, sub: ev.detail || ev.source, time: ago, color, unread: false });
            }
            setNotifications(notifs);
        }).catch(() => { });
    }, []);

    // Read admin name for avatar
    if (typeof window !== "undefined") {
        const data = localStorage.getItem("tagent_admin");
        if (data) {
            const parsed = JSON.parse(data);
            const initial = parsed.name ? parsed.name.charAt(0).toUpperCase() : "A";
            if (initial !== adminInitial) setAdminInitial(initial);
        }
    }

    return (
        <header className="h-14 border-b border-[rgba(255,255,255,0.06)] bg-[#0f1011]/80 backdrop-blur-xl flex items-center justify-between px-5 shrink-0 relative z-10">
            {/* Left: Page title */}
            <div className="flex items-center gap-2.5 min-w-0">
                <h1 className="text-[15px] font-semibold text-slate-900 whitespace-nowrap">{page.title}</h1>
                {page.aiBadge && (
                    <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold text-white shrink-0"
                        style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}
                    >
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5Z" />
                        </svg>
                        AI
                    </span>
                )}
                <span className="text-2xs text-slate-500 hidden lg:block truncate max-w-[400px]">{page.description}</span>
            </div>

            {/* Center: Search */}
            <div className="flex items-center gap-3 mx-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search anything..."
                        className="search-input w-52 lg:w-64 h-8 pl-9 pr-12 rounded-lg text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none border border-[rgba(15,23,42,0.10)]"
                    />
                    <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-2xs text-slate-500 bg-white/70 px-1.5 py-0.5 rounded border border-[rgba(15,23,42,0.10)]">⌘K</kbd>
                </div>
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-2.5 shrink-0">
                {/* Environment */}
                <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/60 border border-[rgba(15,23,42,0.10)] text-xs cursor-pointer hover:border-[rgba(101,49,247,0.3)] transition-colors">
                    <span className="text-slate-400 text-2xs">Environment</span>
                    <span className="text-slate-800 font-medium text-2xs">{environment}</span>
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                </div>

                {/* Cluster */}
                <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/60 border border-[rgba(15,23,42,0.10)] text-xs cursor-pointer hover:border-[rgba(101,49,247,0.3)] transition-colors">
                    <span className="text-slate-400 text-2xs">Cluster</span>
                    <span className="text-slate-800 font-medium font-mono text-2xs">{clusterName}</span>
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                </div>

                {/* Time range dropdown */}
                <div className="hidden lg:block relative">
                    <button
                        onClick={() => setTimeOpen(o => !o)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/60 border border-[rgba(15,23,42,0.10)] text-2xs text-slate-500 cursor-pointer hover:border-[rgba(101,49,247,0.3)] transition-colors"
                    >
                        <Clock className="w-3 h-3" />
                        <span>{timeRange}</span>
                        <ChevronDown className="w-3 h-3 text-slate-500" />
                    </button>
                    {timeOpen && (
                        <div className="absolute top-full mt-1 right-0 z-50 w-36 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] shadow-[0_8px_24px_rgba(0,0,0,0.6)] py-1">
                            {["Last 5m", "Last 15m", "Last 30m", "Last 1h", "Last 6h", "Last 24h", "Last 7d"].map(t => (
                                <button
                                    key={t}
                                    onClick={() => { setTimeRange(t); setTimeOpen(false); }}
                                    className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-[rgba(15,23,42,0.10)] transition-colors ${timeRange === t ? "text-[#7170ff]" : "text-[#f7f8f8]"}`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Live indicator */}
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <Radio className="w-3 h-3 text-emerald-400 animate-pulse-glow" />
                    <span className="text-2xs text-emerald-400 font-semibold">Live</span>
                </div>

                {/* Notifications */}
                <div className="relative">
                    <button
                        onClick={() => setNotifOpen(o => !o)}
                        className="relative w-8 h-8 rounded-lg bg-white/60 border border-[rgba(15,23,42,0.10)] flex items-center justify-center hover:bg-white/80 hover:border-[rgba(101,49,247,0.3)] transition-colors"
                    >
                        <Bell className="w-4 h-4 text-slate-500" />
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border-2 border-white flex items-center justify-center text-[8px] text-white font-bold">12</span>
                    </button>

                    {/* Notification Panel */}
                    {notifOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                            <div className="absolute top-full mt-2 right-0 z-50 w-[360px] rounded-xl border border-[rgba(15,23,42,0.10)] shadow-[0_16px_48px_rgba(15,23,42,0.18)]" style={{ background: "rgba(255, 255, 255, 0.95)", backdropFilter: "blur(16px)" }}>
                                {/* Header */}
                                <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(15,23,42,0.08)]">
                                    <h3 className="text-[13px] font-semibold text-slate-900">Notifications</h3>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-slate-500">{notifications.filter(n => n.unread).length} unread</span>
                                        <button onClick={() => setNotifOpen(false)} className="text-slate-500 hover:text-slate-200">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                        </button>
                                    </div>
                                </div>
                                {/* Notifications list */}
                                <div className="max-h-[400px] overflow-y-auto">
                                    {notifications.length === 0 && (
                                        <div className="px-4 py-6 text-center">
                                            <p className="text-[11px] text-slate-500">No notifications</p>
                                        </div>
                                    )}
                                    {notifications.map((n, i) => (
                                        <div key={i} className={`flex items-start gap-3 px-4 py-2.5 border-b border-[rgba(15,23,42,0.05)] hover:bg-[rgba(15,23,42,0.02)] transition-colors cursor-pointer ${n.unread ? "bg-[#7170ff]/[0.04]" : ""}`}>
                                            <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: n.color, boxShadow: `0 0 4px ${n.color}` }} />
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-[11.5px] leading-snug ${n.unread ? "text-slate-900 font-semibold" : "text-slate-600"}`}>{n.title}</p>
                                                <p className="text-[10px] text-slate-500 mt-0.5">{n.sub}</p>
                                            </div>
                                            <span className="text-[9px] text-slate-400 font-mono shrink-0 mt-0.5">{n.time}</span>
                                        </div>
                                    ))}
                                </div>
                                {/* Footer */}
                                <div className="px-4 py-2.5 border-t border-[rgba(15,23,42,0.08)] flex items-center justify-between">
                                    <button className="text-[10px] text-[#7170ff] hover:text-[#828fff] font-medium">Mark all as read</button>
                                    <a href="/logs" className="text-[10px] text-[#7170ff] hover:text-[#828fff] font-medium">View all notifications →</a>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7170ff] to-[#828fff] border border-[#7170ff]/40 flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity">
                    <span className="text-xs text-white font-semibold">{adminInitial}</span>
                </div>
            </div>
        </header>
    );
}
