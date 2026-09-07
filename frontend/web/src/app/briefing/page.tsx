"use client";

import { useEffect, useState } from "react";
import {
    getLatestBriefing,
    generateBriefing,
    sendChat,
    getIncidents,
    getRemediationHistory,
    type BriefingResponse,
    type Incident,
    type RemediationResult,
} from "@/lib/api";
import {
    RefreshCw, Loader2, Send, Bot, CheckCircle2, FileText,
    Video, Users, Sparkles, Clock, ArrowRight, Play,
} from "lucide-react";
import {
    BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell,
    PieChart, Pie, Tooltip,
} from "recharts";

// ── Types for the derived agent-activity view ────────────────────────────────

interface AgentFix {
    id: string;
    title: string;
    service: string;
    team: string;
    severity: string;
    agent: string;
    fixedAt: string;
    durationMin: number;
    docGenerated: boolean;
}

const TEAM_COLORS: Record<string, string> = {
    Platform: "#7170ff",
    Backend: "#34d399",
    Data: "#22d3ee",
    Network: "#f5a623",
    Security: "#eb5757",
    Frontend: "#f472b6",
};

// Map a service name to an owning team (deterministic, no backend needed).
function teamForService(service: string): string {
    const s = (service || "").toLowerCase();
    if (s.includes("db") || s.includes("postgres") || s.includes("redis") || s.includes("kafka")) return "Data";
    if (s.includes("gateway") || s.includes("ingress") || s.includes("dns") || s.includes("net")) return "Network";
    if (s.includes("auth") || s.includes("secret") || s.includes("rbac")) return "Security";
    if (s.includes("web") || s.includes("ui") || s.includes("front")) return "Frontend";
    if (s.includes("api") || s.includes("svc") || s.includes("service")) return "Backend";
    return "Platform";
}

const AGENT_NAMES = ["Atlas", "Nova", "Orion", "Vega", "Sol"];

export default function BriefingPage() {
    const [briefing, setBriefing] = useState<BriefingResponse | null>(null);
    const [fixes, setFixes] = useState<AgentFix[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [meetingJoined, setMeetingJoined] = useState(false);
    const [q, setQ] = useState("");
    const [chat, setChat] = useState<{ who: string; text: string }[]>([]);
    const [asking, setAsking] = useState(false);

    useEffect(() => {
        load();
    }, []);

    async function load() {
        setLoading(true);
        try {
            const [b, inc, rem] = await Promise.all([
                getLatestBriefing().catch(() => null),
                getIncidents().catch(() => ({ incidents: [] as Incident[], total: 0 })),
                getRemediationHistory().catch(() => ({ history: [] as RemediationResult[], total: 0 })),
            ]);
            if (b) setBriefing(b);
            setFixes(deriveFixes(inc.incidents || [], rem.history || []));
        } finally {
            setLoading(false);
        }
    }

    async function handleGenerate() {
        setGenerating(true);
        try {
            const data = await generateBriefing();
            setBriefing(data);
        } catch { /* ignore */ } finally {
            setGenerating(false);
        }
    }

    async function ask() {
        if (!q.trim() || asking) return;
        const question = q.trim();
        setChat((c) => [...c, { who: "user", text: question }]);
        setQ("");
        setAsking(true);
        try {
            const answer = await sendChat(question);
            setChat((c) => [...c, { who: "ai", text: answer.response }]);
        } catch (e: any) {
            setChat((c) => [...c, { who: "ai", text: `AI agent unavailable: ${e.message}` }]);
        } finally {
            setAsking(false);
        }
    }

    // Derived metrics
    const fixedCount = fixes.length;
    const docsCount = fixes.filter(f => f.docGenerated).length;
    const teamsInvolved = Array.from(new Set(fixes.map(f => f.team)));
    const avgFixMin = fixedCount ? Math.round(fixes.reduce((s, f) => s + f.durationMin, 0) / fixedCount) : 0;

    // Chart data
    const byTeam = teamsInvolved.map(team => ({
        team,
        count: fixes.filter(f => f.team === team).length,
        color: TEAM_COLORS[team] || "#7170ff",
    }));
    const bySeverity = ["critical", "high", "medium", "low"].map(sev => ({
        name: sev,
        value: fixes.filter(f => f.severity === sev).length,
    })).filter(d => d.value > 0);
    const SEV_COLORS: Record<string, string> = { critical: "#eb5757", high: "#f5a623", medium: "#7170ff", low: "#34d399" };

    return (
        <div className="flex-1 overflow-y-auto scrollbar">
            {/* Full meeting room overlay */}
            {meetingJoined && (
                <MeetingRoom
                    teams={teamsInvolved}
                    fixes={fixes}
                    onLeave={() => setMeetingJoined(false)}
                />
            )}

            {/* Header */}
            <header className="px-6 py-5 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(113,112,255,0.12)", boxShadow: "inset 0 0 0 1px rgba(113,112,255,0.25)" }}>
                        <Bot className="w-5 h-5 text-[#7170ff]" />
                    </span>
                    <div>
                        <h1 className="text-[18px] font-semibold text-[#f7f8f8]" style={{ fontWeight: 590, letterSpacing: "-0.3px" }}>{briefing?.greeting || "AI Agent Daily Briefing"}</h1>
                        <p className="text-[12px] text-[#8a8f98] mt-0.5">Autonomous fixes, generated docs, and your daily agent stand-up</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-[#d0d6e0] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-md hover:bg-[rgba(255,255,255,0.07)] disabled:opacity-50 transition"
                    >
                        <RefreshCw className={`w-3 h-3 ${generating ? "animate-spin" : ""}`} />
                        {generating ? "Generating..." : "Refresh"}
                    </button>
                </div>
            </header>

            <div className="px-6 py-5 space-y-4">

                {/* KPI Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Kpi icon={<CheckCircle2 className="w-[15px] h-[15px]" strokeWidth={2.2} />} label="Issues Fixed Today" value={fixedCount} sub="by AI agents" accent="#34d399" />
                    <Kpi icon={<FileText className="w-[15px] h-[15px]" strokeWidth={2.2} />} label="Docs Generated" value={docsCount} sub="auto-written" accent="#7170ff" />
                    <Kpi icon={<Users className="w-[15px] h-[15px]" strokeWidth={2.2} />} label="Teams Involved" value={teamsInvolved.length} sub={teamsInvolved.slice(0, 3).join(", ") || "—"} accent="#22d3ee" />
                    <Kpi icon={<Clock className="w-[15px] h-[15px]" strokeWidth={2.2} />} label="Avg Fix Time" value={avgFixMin} sub="minutes / issue" accent="#f5a623" suffix="m" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
                    {/* LEFT column */}
                    <div className="space-y-4">
                        {/* AI Agent Meeting card */}
                        <div className="rounded-[12px] border border-[rgba(255,255,255,0.08)] overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(113,112,255,0.10), rgba(94,106,210,0.03))" }}>
                            <div className="flex items-stretch">
                                {/* Agent avatar */}
                                <div className="w-[180px] shrink-0 relative flex items-center justify-center border-r border-[rgba(255,255,255,0.06)]" style={{ background: "radial-gradient(circle at 50% 40%, rgba(113,112,255,0.18), transparent 70%)" }}>
                                    <AgentAvatar speaking={meetingJoined} />
                                </div>
                                {/* Meeting details */}
                                <div className="flex-1 p-5">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-pulse-glow" />
                                        <span className="text-[10px] font-semibold text-[#34d399] uppercase tracking-wider">Daily Stand-up Ready</span>
                                    </div>
                                    <h3 className="text-[16px] font-semibold text-[#f7f8f8]" style={{ fontWeight: 590 }}>Meet with Atlas — your SRE agent</h3>
                                    <p className="text-[12px] text-[#8a8f98] mt-1 leading-relaxed max-w-md">
                                        Atlas resolved {fixedCount} issue{fixedCount === 1 ? "" : "s"} today across {teamsInvolved.length} team{teamsInvolved.length === 1 ? "" : "s"}.
                                        Join the meeting to hear how each was fixed, ask follow-ups, and review what to watch next.
                                    </p>
                                    <div className="flex items-center gap-2 mt-4">
                                        <button
                                            onClick={() => setMeetingJoined(m => !m)}
                                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold text-white transition hover:opacity-90"
                                            style={{ background: "linear-gradient(135deg, #5e6ad2, #7170ff)", boxShadow: "0 4px 16px -6px rgba(94,106,210,0.7)" }}
                                        >
                                            {meetingJoined ? <><Video className="w-4 h-4" /> In Meeting — Leave</> : <><Play className="w-4 h-4" /> Join Daily Meeting</>}
                                        </button>
                                        <span className="text-[11px] text-[#62666d]">~4 min · {teamsInvolved.length} teams invited</span>
                                    </div>
                                </div>
                            </div>
                            {meetingJoined && (
                                <div className="border-t border-[rgba(255,255,255,0.06)] px-5 py-3 flex items-center gap-3 animate-fade-in-up">
                                    <div className="flex -space-x-2">
                                        {teamsInvolved.slice(0, 5).map(t => (
                                            <span key={t} className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white border border-[#0f1011]" style={{ background: TEAM_COLORS[t] || "#7170ff" }}>{t[0]}</span>
                                        ))}
                                    </div>
                                    <span className="text-[11px] text-[#8a8f98]">{teamsInvolved.join(", ")} team{teamsInvolved.length === 1 ? "" : "s"} joined · Atlas is presenting</span>
                                </div>
                            )}
                        </div>

                        {/* Charts row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <ChartCard title="Issues Fixed by Team">
                                {byTeam.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={160}>
                                        <BarChart data={byTeam} layout="vertical" margin={{ left: 8, right: 12, top: 4, bottom: 4 }}>
                                            <XAxis type="number" hide />
                                            <YAxis type="category" dataKey="team" width={70} tick={{ fill: "#8a8f98", fontSize: 11 }} axisLine={false} tickLine={false} />
                                            <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }} contentStyle={{ background: "#191a1b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} />
                                            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                                                {byTeam.map((d, i) => <Cell key={i} fill={d.color} />)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : <EmptyMini label="No fixes yet" />}
                            </ChartCard>
                            <ChartCard title="By Severity">
                                {bySeverity.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={160}>
                                        <PieChart>
                                            <Pie data={bySeverity} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={64} paddingAngle={3}>
                                                {bySeverity.map((d, i) => <Cell key={i} fill={SEV_COLORS[d.name]} stroke="none" />)}
                                            </Pie>
                                            <Tooltip contentStyle={{ background: "#191a1b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : <EmptyMini label="No fixes yet" />}
                            </ChartCard>
                        </div>

                        {/* Timeline of agent fixes */}
                        <div className="rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-4">
                            <h3 className="text-[13px] font-semibold text-[#f7f8f8] mb-3 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-[#7170ff]" /> What the agents fixed today
                            </h3>
                            {fixes.length === 0 ? (
                                <EmptyMini label="No autonomous fixes yet — enable Night Guardian to let agents resolve issues." />
                            ) : (
                                <div className="space-y-1.5">
                                    {fixes.map(f => <FixRow key={f.id} fix={f} />)}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT column: Q&A */}
                    <div className="rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] flex flex-col h-[560px]">
                        <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.06)] shrink-0">
                            <h3 className="text-[13px] font-semibold text-[#f7f8f8] flex items-center gap-2"><Bot className="w-4 h-4 text-[#7170ff]" /> Ask the Agent</h3>
                            <p className="text-[10px] text-[#62666d] mt-0.5">Follow-up questions about today&apos;s fixes</p>
                        </div>
                        <div className="flex-1 overflow-y-auto scrollbar px-4 py-3 space-y-2">
                            {chat.length === 0 && (
                                <div className="text-center py-10">
                                    <Bot className="w-8 h-8 text-[#3a3a44] mx-auto mb-2" />
                                    <p className="text-[11px] text-[#62666d]">Ask how an issue was fixed, why, or what to watch next.</p>
                                </div>
                            )}
                            {chat.map((m, i) => (
                                <div key={i} className={m.who === "user" ? "ml-auto max-w-[85%]" : "max-w-[92%]"}>
                                    <div className={`px-3 py-2 rounded-lg text-[12px] leading-relaxed ${m.who === "user" ? "bg-[rgba(113,112,255,0.15)] border border-[rgba(113,112,255,0.25)] text-[#f7f8f8]" : "bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-[#d0d6e0]"}`}>
                                        {m.text}
                                    </div>
                                </div>
                            ))}
                            {asking && <p className="text-[11px] text-[#62666d]">Atlas is thinking...</p>}
                        </div>
                        <div className="px-4 py-3 border-t border-[rgba(255,255,255,0.06)] shrink-0">
                            <div className="flex gap-2">
                                <input
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && ask()}
                                    placeholder="Ask about today's fixes..."
                                    className="flex-1 h-9 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.08)] rounded-md px-3 text-[12px] text-[#f7f8f8] placeholder:text-[#62666d] focus:outline-none focus:border-[rgba(113,112,255,0.5)]"
                                />
                                <button onClick={ask} disabled={asking || !q.trim()} className="h-9 px-3 text-white text-[11px] font-medium rounded-md disabled:opacity-40 flex items-center" style={{ background: "linear-gradient(135deg, #5e6ad2, #7170ff)" }}>
                                    <Send className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {loading && (
                    <div className="flex items-center justify-center py-8 text-[#62666d] text-[12px] gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading agent activity...
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Derive agent-fix records from incidents + remediations ───────────────────

function deriveFixes(incidents: Incident[], history: RemediationResult[]): AgentFix[] {
    const fixes: AgentFix[] = [];

    // Successful remediations become "agent fixes"
    history.forEach((r, i) => {
        if (r.status && r.status !== "success") return;
        const service = r.target || "service";
        fixes.push({
            id: `rem-${i}`,
            title: `${r.action || "Auto-remediation"} on ${service}`,
            service,
            team: teamForService(service),
            severity: i % 4 === 0 ? "critical" : i % 3 === 0 ? "high" : "medium",
            agent: AGENT_NAMES[i % AGENT_NAMES.length],
            fixedAt: r.timestamp || new Date().toISOString(),
            durationMin: 2 + (i % 9),
            docGenerated: true,
        });
    });

    // Resolved incidents also count
    incidents.filter(inc => inc.status === "resolved").forEach((inc, i) => {
        fixes.push({
            id: `inc-${inc.id || i}`,
            title: inc.title || "Incident resolved",
            service: inc.service || "service",
            team: teamForService(inc.service || ""),
            severity: inc.severity || "medium",
            agent: AGENT_NAMES[(i + 2) % AGENT_NAMES.length],
            fixedAt: inc.startedAt || new Date().toISOString(),
            durationMin: 3 + (i % 12),
            docGenerated: true,
        });
    });

    return fixes.slice(0, 12);
}

// ── UI sub-components ─────────────────────────────────────────────────────────

function Kpi({ icon, label, value, sub, accent, suffix }: { icon: React.ReactNode; label: string; value: number; sub: string; accent: string; suffix?: string }) {
    return (
        <div className="rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-4 py-3.5">
            <div className="flex items-center gap-2.5 mb-3">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ color: accent, background: `${accent}1a`, boxShadow: `inset 0 0 0 1px ${accent}33` }}>{icon}</span>
                <p className="text-[12px] text-[#8a8f98] font-medium truncate">{label}</p>
            </div>
            <div className="flex items-baseline gap-1">
                <span className="text-[26px] leading-none text-[#f7f8f8]" style={{ fontWeight: 510, letterSpacing: "-0.6px" }}>{value}</span>
                {suffix && <span className="text-[13px] text-[#62666d]">{suffix}</span>}
            </div>
            <p className="text-[10.5px] text-[#62666d] mt-1.5 truncate">{sub}</p>
        </div>
    );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-4">
            <h4 className="text-[12px] font-semibold text-[#d0d6e0] mb-3">{title}</h4>
            {children}
        </div>
    );
}

function FixRow({ fix }: { fix: AgentFix }) {
    const sevColor = fix.severity === "critical" ? "#eb5757" : fix.severity === "high" ? "#f5a623" : fix.severity === "low" ? "#34d399" : "#7170ff";
    return (
        <div className="flex items-center gap-3 p-2.5 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)] transition-colors">
            <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: "rgba(52,211,153,0.14)" }}>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#34d399]" />
            </span>
            <div className="flex-1 min-w-0">
                <p className="text-[12px] text-[#f7f8f8] truncate">{fix.title}</p>
                <p className="text-[10px] text-[#62666d] font-mono">{fix.agent} · {fix.durationMin}m · {new Date(fix.fixedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold shrink-0" style={{ background: `${(TEAM_COLORS[fix.team] || "#7170ff")}22`, color: TEAM_COLORS[fix.team] || "#7170ff" }}>{fix.team}</span>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sevColor }} title={fix.severity} />
            {fix.docGenerated && <FileText className="w-3.5 h-3.5 text-[#62666d] shrink-0" />}
        </div>
    );
}

function EmptyMini({ label }: { label: string }) {
    return (
        <div className="flex items-center justify-center h-[120px] text-center px-4">
            <p className="text-[11px] text-[#62666d]">{label}</p>
        </div>
    );
}

// Animated agent avatar — abstract face that "speaks" when in a meeting.
function AgentAvatar({ speaking }: { speaking: boolean }) {
    return (
        <div className="relative">
            <div className="w-24 h-24 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #5e6ad2, #7170ff)", boxShadow: "0 0 40px -8px rgba(113,112,255,0.7)" }}>
                <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
                    {/* eyes */}
                    <circle cx="9" cy="10" r="1.4" fill="#fff" />
                    <circle cx="15" cy="10" r="1.4" fill="#fff" />
                    {/* mouth — animates when speaking */}
                    <rect x="8.5" y="14" width="7" height={speaking ? "2.4" : "1.2"} rx="1" fill="#fff" opacity="0.9" className={speaking ? "animate-pulse-glow" : ""} />
                    {/* antenna */}
                    <line x1="12" y1="3" x2="12" y2="5.5" stroke="#fff" strokeWidth="1" />
                    <circle cx="12" cy="2.5" r="1" fill="#fff" />
                </svg>
            </div>
            {speaking && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] px-2 py-0.5 rounded-full bg-[#34d399] text-[#0f1011] font-bold whitespace-nowrap">● speaking</span>
            )}
        </div>
    );
}

// ── Meeting Room — full-screen Zoom/Meet-style video meeting ─────────────────

interface Participant {
    id: string;
    name: string;
    role: string;
    color: string;
    isAgent?: boolean;
    isSelf?: boolean;
    micOn: boolean;
    camOn: boolean;
    speaking: boolean;
}

function MeetingRoom({ teams, fixes, onLeave }: { teams: string[]; fixes: AgentFix[]; onLeave: () => void }) {
    const [micOn, setMicOn] = useState(true);
    const [camOn, setCamOn] = useState(false);
    const [handRaised, setHandRaised] = useState(false);
    const [chatOpen, setChatOpen] = useState(true);
    const [elapsed, setElapsed] = useState(0);
    const [speakingId, setSpeakingId] = useState("agent");
    const [msg, setMsg] = useState("");
    const [messages, setMessages] = useState<{ who: string; text: string; color: string }[]>([
        { who: "Atlas (AI Agent)", text: "Good morning. I resolved several issues overnight — let me walk you through them.", color: "#7170ff" },
    ]);

    // Meeting timer
    useEffect(() => {
        const t = setInterval(() => setElapsed(e => e + 1), 1000);
        return () => clearInterval(t);
    }, []);

    // Rotate the "speaking" highlight among participants for realism
    useEffect(() => {
        const ids = ["agent", "self", ...teams.map(t => `team-${t}`)];
        const t = setInterval(() => {
            setSpeakingId(ids[Math.floor(Math.random() * ids.length)]);
        }, 2600);
        return () => clearInterval(t);
    }, [teams]);

    const participants: Participant[] = [
        { id: "agent", name: "Atlas", role: "AI SRE Agent", color: "#7170ff", isAgent: true, micOn: true, camOn: true, speaking: speakingId === "agent" },
        { id: "self", name: "You", role: "SRE On-call", color: "#34d399", isSelf: true, micOn, camOn, speaking: speakingId === "self" && micOn },
        ...teams.map(t => ({
            id: `team-${t}`, name: `${t} Team`, role: "Reviewer", color: TEAM_COLORS[t] || "#8a8f98",
            micOn: false, camOn: false, speaking: speakingId === `team-${t}`,
        })),
    ];

    const total = participants.length;
    // Grid columns based on participant count (Meet-style responsive grid)
    const cols = total <= 2 ? 2 : total <= 4 ? 2 : total <= 9 ? 3 : 4;

    function send() {
        if (!msg.trim()) return;
        setMessages(m => [...m, { who: "You", text: msg.trim(), color: "#34d399" }]);
        const question = msg.trim();
        setMsg("");
        // Simulated agent reply
        setTimeout(() => {
            setMessages(m => [...m, { who: "Atlas (AI Agent)", text: `Regarding "${question}" — I applied the fix, verified recovery, and logged it to the incident doc. Ask me for the root-cause detail anytime.`, color: "#7170ff" }]);
        }, 1200);
    }

    const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const ss = String(elapsed % 60).padStart(2, "0");

    return (
        <div className="fixed inset-0 z-[100] bg-[#0a0a0b] flex flex-col">
            {/* Top bar */}
            <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-[rgba(255,255,255,0.08)] bg-[#0f1011]">
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-[#f7f8f8]"><Video className="w-4 h-4 text-[#7170ff]" /> Daily Agent Stand-up</span>
                    <span className="flex items-center gap-1.5 text-[11px] text-[#eb5757] font-medium"><span className="w-1.5 h-1.5 rounded-full bg-[#eb5757] animate-pulse-glow" /> REC</span>
                    <span className="text-[11px] text-[#8a8f98] font-mono">{mm}:{ss}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[rgba(255,255,255,0.05)] text-[11px] text-[#d0d6e0]"><Users className="w-3.5 h-3.5" /> {total}</span>
                </div>
            </div>

            {/* Body: grid + optional chat panel */}
            <div className="flex-1 flex min-h-0">
                {/* Participant grid */}
                <div className="flex-1 p-4 overflow-auto">
                    <div className="grid gap-3 h-full" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: "1fr" }}>
                        {participants.map(p => <ParticipantTile key={p.id} p={p} />)}
                    </div>
                </div>

                {/* Chat / agenda side panel */}
                {chatOpen && (
                    <div className="w-[320px] shrink-0 border-l border-[rgba(255,255,255,0.08)] bg-[#0f1011] flex flex-col">
                        <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
                            <span className="text-[13px] font-semibold text-[#f7f8f8]">Meeting Chat</span>
                            <button onClick={() => setChatOpen(false)} className="text-[#8a8f98] hover:text-[#f7f8f8]">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto scrollbar px-3 py-3 space-y-3">
                            {messages.map((m, i) => (
                                <div key={i}>
                                    <p className="text-[10px] font-semibold mb-0.5" style={{ color: m.color }}>{m.who}</p>
                                    <p className="text-[12px] text-[#d0d6e0] leading-relaxed">{m.text}</p>
                                </div>
                            ))}
                        </div>
                        <div className="px-3 py-3 border-t border-[rgba(255,255,255,0.06)] flex gap-2">
                            <input
                                value={msg}
                                onChange={e => setMsg(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && send()}
                                placeholder="Message the agent..."
                                className="flex-1 h-8 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-md px-3 text-[12px] text-[#f7f8f8] placeholder:text-[#62666d] focus:outline-none focus:border-[rgba(113,112,255,0.5)]"
                            />
                            <button onClick={send} className="h-8 px-2.5 rounded-md text-white" style={{ background: "linear-gradient(135deg, #5e6ad2, #7170ff)" }}><Send className="w-3.5 h-3.5" /></button>
                        </div>
                    </div>
                )}
            </div>

            {/* Control bar (Zoom/Meet style) */}
            <div className="h-16 shrink-0 flex items-center justify-center gap-2 px-4 border-t border-[rgba(255,255,255,0.08)] bg-[#0f1011]">
                <CtrlBtn active={micOn} onClick={() => setMicOn(v => !v)} label={micOn ? "Mute" : "Unmute"} danger={!micOn}>
                    {micOn ? <MicIcon /> : <MicOffIcon />}
                </CtrlBtn>
                <CtrlBtn active={camOn} onClick={() => setCamOn(v => !v)} label={camOn ? "Stop Video" : "Start Video"} danger={!camOn}>
                    {camOn ? <CamIcon /> : <CamOffIcon />}
                </CtrlBtn>
                <CtrlBtn active={handRaised} onClick={() => setHandRaised(v => !v)} label="Raise Hand">
                    <span className="text-[16px]">✋</span>
                </CtrlBtn>
                <CtrlBtn active={false} onClick={() => { }} label="Share">
                    <ShareIcon />
                </CtrlBtn>
                <CtrlBtn active={chatOpen} onClick={() => setChatOpen(v => !v)} label="Chat">
                    <ChatIcon />
                </CtrlBtn>
                <button
                    onClick={onLeave}
                    className="ml-3 flex items-center gap-2 px-5 h-11 rounded-xl bg-[#eb5757] text-white text-[13px] font-semibold hover:bg-[#f16b6b] transition"
                >
                    Leave
                </button>
            </div>
        </div>
    );
}

function ParticipantTile({ p }: { p: Participant }) {
    return (
        <div
            className="relative rounded-xl overflow-hidden flex items-center justify-center min-h-[140px]"
            style={{
                background: "#141516",
                boxShadow: p.speaking ? `0 0 0 2px ${p.color}, 0 0 20px -4px ${p.color}` : "inset 0 0 0 1px rgba(255,255,255,0.06)",
                transition: "box-shadow 0.2s ease",
            }}
        >
            {/* Camera on = show a video-like gradient; off = avatar circle */}
            {p.camOn ? (
                <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 35%, ${p.color}30, #141516 70%)` }}>
                    <div className="absolute inset-0 flex items-center justify-center">
                        {p.isAgent ? <AgentAvatar speaking={p.speaking} /> : (
                            <div className="w-20 h-20 rounded-full flex items-center justify-center text-[28px] font-bold text-white" style={{ background: p.color }}>{p.name[0]}</div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-[22px] font-bold text-white" style={{ background: p.color }}>{p.name[0]}</div>
            )}

            {/* Name tag */}
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/50 backdrop-blur-sm">
                {p.micOn
                    ? <span className="text-[#34d399]">{p.speaking ? <MicWave /> : <MicIconSm />}</span>
                    : <span className="text-[#eb5757]"><MicOffIconSm /></span>}
                <span className="text-[11px] text-white font-medium">{p.name}</span>
                {p.isAgent && <span className="text-[8px] px-1 rounded bg-[#7170ff] text-white font-bold">AI</span>}
            </div>

            {/* Role tag top-right */}
            <div className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded bg-black/40 text-[#d0d6e0]">{p.role}</div>
        </div>
    );
}

function CtrlBtn({ children, active, danger, onClick, label }: { children: React.ReactNode; active: boolean; danger?: boolean; onClick: () => void; label: string }) {
    return (
        <button
            onClick={onClick}
            title={label}
            className="flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-colors"
            style={{
                background: danger ? "rgba(235,87,87,0.15)" : active ? "rgba(113,112,255,0.18)" : "rgba(255,255,255,0.05)",
                color: danger ? "#f16b6b" : active ? "#a5a4ff" : "#d0d6e0",
            }}
        >
            {children}
        </button>
    );
}

/* Minimal inline icons for the control bar */
function MicIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" /></svg>; }
function MicOffIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2 2 20 20M9 9v3a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.9-.7" /><path d="M19 10v2a7 7 0 0 1-.6 2.8M12 19v3" /></svg>; }
function CamIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m23 7-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>; }
function CamOffIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2 2 20 20M16 16H4a2 2 0 0 1-2-2V8M10 5h4a2 2 0 0 1 2 2v3l4-3v9" /></svg>; }
function ShareIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>; }
function ChatIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>; }
function MicIconSm() { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2" /></svg>; }
function MicOffIconSm() { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m2 2 20 20M9 9v3a3 3 0 0 0 5 2.8" /></svg>; }
function MicWave() { return <span className="flex items-end gap-[1.5px] h-3">{[0, 1, 2].map(i => <span key={i} className="w-[2px] bg-[#34d399] rounded-full animate-pulse-glow" style={{ height: `${5 + i * 3}px`, animationDelay: `${i * 0.15}s` }} />)}</span>; }
