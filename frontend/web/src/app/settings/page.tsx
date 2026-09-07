"use client";

import { useEffect, useState } from "react";
import {
    getEscalationConfig,
    updateEscalationConfig,
    getActiveEscalations,
    getEscalationHistory,
    acknowledgeEscalation,
    type EscalationConfig,
    type ActiveEscalation,
} from "@/lib/api";
import { Bell, Phone, Mail, MessageSquare, Zap, Shield, Clock, Check, Loader2, WifiOff } from "lucide-react";

export default function SettingsPage() {
    const [tab, setTab] = useState<"escalation" | "active" | "history">("escalation");
    const [config, setConfig] = useState<EscalationConfig | null>(null);
    const [active, setActive] = useState<ActiveEscalation[]>([]);
    const [history, setHistory] = useState<ActiveEscalation[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);
        try {
            const [cfg, act, hist] = await Promise.all([
                getEscalationConfig().catch(() => null),
                getActiveEscalations().catch(() => ({ escalations: [], total: 0 })),
                getEscalationHistory().catch(() => ({ escalations: [], total: 0 })),
            ]);
            if (cfg) setConfig(cfg);
            setActive(act.escalations || []);
            setHistory(hist.escalations || []);
            setError(null);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        if (!config) return;
        setSaving(true);
        try {
            await updateEscalationConfig(config);
            alert("Escalation config saved.");
        } catch (e: any) {
            alert(`Save failed: ${e.message}`);
        } finally {
            setSaving(false);
        }
    }

    async function handleAck(incidentId: string) {
        try {
            await acknowledgeEscalation(incidentId, "admin");
            await fetchData();
        } catch (e: any) {
            alert(`Acknowledge failed: ${e.message}`);
        }
    }

    return (
        <div className="flex-1 overflow-y-auto scrollbar bg-[rgba(255,255,255,0.02)]">
            <header className="px-6 py-5 border-b border-zinc-800/60">
                <h1 className="text-lg font-semibold text-zinc-100">Settings — Escalation Chain</h1>
                <p className="text-sm text-zinc-500 mt-0.5">Configure automated alert escalation: Slack → Email → Phone → Auto-Fix</p>
            </header>

            {/* Tabs */}
            <div className="px-6 pt-4 flex gap-1 border-b border-zinc-800/60">
                {[
                    { id: "escalation", label: "Configuration", icon: <Bell className="w-3.5 h-3.5" /> },
                    { id: "active", label: `Active (${active.length})`, icon: <Zap className="w-3.5 h-3.5" /> },
                    { id: "history", label: "History", icon: <Clock className="w-3.5 h-3.5" /> },
                ].map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id as any)}
                        className={`flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-medium rounded-t-md transition-colors ${tab === t.id ? "text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/5" : "text-zinc-500 hover:text-zinc-300"}`}
                    >
                        {t.icon}{t.label}
                    </button>
                ))}
                <div className="ml-auto flex items-center gap-2">
                    {loading && <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />}
                    {error && <WifiOff className="w-4 h-4 text-amber-400" />}
                </div>
            </div>

            <div className="px-6 py-5">
                {/* Configuration Tab */}
                {tab === "escalation" && config && (
                    <div className="space-y-6 max-w-3xl">
                        {/* Enable/Disable */}
                        <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
                            <div>
                                <p className="text-[13px] font-semibold text-zinc-100">Enable Escalation Chain</p>
                                <p className="text-[11px] text-zinc-500 mt-0.5">When enabled, incidents above minimum severity trigger the escalation chain.</p>
                            </div>
                            <button
                                onClick={() => setConfig({ ...config, enabled: !config.enabled })}
                                className={`w-11 h-6 rounded-full transition-colors ${config.enabled ? "bg-emerald-500" : "bg-zinc-700"}`}
                            >
                                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${config.enabled ? "translate-x-[22px]" : "translate-x-[2px]"}`} />
                            </button>
                        </div>

                        {/* Escalation Sequence Visual */}
                        <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
                            <p className="text-[12px] font-semibold text-zinc-200 mb-3">Escalation Sequence</p>
                            <div className="flex items-center gap-2 overflow-x-auto pb-2">
                                {[
                                    { icon: <MessageSquare className="w-4 h-4" />, label: "Slack", time: "T+0s", color: "#3fb950" },
                                    { icon: <Mail className="w-4 h-4" />, label: "Email", time: "T+0s", color: "#7170ff" },
                                    { icon: <Phone className="w-4 h-4" />, label: "Phone (Primary)", time: `T+${config.phone_delay_min}m`, color: "#f0883e" },
                                    { icon: <Phone className="w-4 h-4" />, label: "Phone (Secondary)", time: `T+${config.phone_delay_min + 2}m`, color: "#f85149" },
                                    { icon: <Zap className="w-4 h-4" />, label: "Auto-Fix", time: `T+${config.auto_fix_delay_min}m`, color: "#a371f7" },
                                ].map((step, i) => (
                                    <div key={i} className="flex items-center gap-2 shrink-0">
                                        <div className="flex flex-col items-center gap-1 p-2 rounded-lg border border-zinc-800 bg-[rgba(255,255,255,0.02)] min-w-[90px]">
                                            <div style={{ color: step.color }}>{step.icon}</div>
                                            <span className="text-[10px] text-zinc-300 font-medium">{step.label}</span>
                                            <span className="text-[9px] font-mono" style={{ color: step.color }}>{step.time}</span>
                                        </div>
                                        {i < 4 && <span className="text-zinc-600">→</span>}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Contact Config */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Section title="Primary Contact">
                                <Field label="Phone Number" value={config.primary_phone} onChange={(v) => setConfig({ ...config, primary_phone: v })} placeholder="+1 555 123 4567" />
                                <Field label="Email" value={config.primary_email} onChange={(v) => setConfig({ ...config, primary_email: v })} placeholder="oncall@company.com" />
                                <Field label="Slack User" value={config.primary_slack_user} onChange={(v) => setConfig({ ...config, primary_slack_user: v })} placeholder="@username" />
                            </Section>
                            <Section title="Secondary Contact (Backup)">
                                <Field label="Phone Number" value={config.secondary_phone} onChange={(v) => setConfig({ ...config, secondary_phone: v })} placeholder="+1 555 987 6543" />
                                <Field label="Email" value={config.secondary_email} onChange={(v) => setConfig({ ...config, secondary_email: v })} placeholder="backup@company.com" />
                            </Section>
                        </div>

                        {/* Timing Config */}
                        <Section title="Timing & Rules">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <Field label="Phone Delay (min)" value={String(config.phone_delay_min)} onChange={(v) => setConfig({ ...config, phone_delay_min: parseInt(v) || 3 })} placeholder="3" />
                                <Field label="Auto-Fix Delay (min)" value={String(config.auto_fix_delay_min)} onChange={(v) => setConfig({ ...config, auto_fix_delay_min: parseInt(v) || 10 })} placeholder="10" />
                                <Field label="Quiet Hours Start" value={config.quiet_start} onChange={(v) => setConfig({ ...config, quiet_start: v })} placeholder="22:00" />
                                <Field label="Quiet Hours End" value={config.quiet_end} onChange={(v) => setConfig({ ...config, quiet_end: v })} placeholder="06:00" />
                            </div>
                            <div className="mt-3">
                                <label className="text-[11px] text-[#64748b] block mb-1">Minimum Severity to Trigger</label>
                                <select
                                    value={config.min_severity}
                                    onChange={(e) => setConfig({ ...config, min_severity: e.target.value })}
                                    className="h-9 px-3 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] text-[12px] text-[#f7f8f8]"
                                >
                                    <option value="critical">Critical only</option>
                                    <option value="high">High and above</option>
                                    <option value="medium">Medium and above</option>
                                    <option value="low">All severities</option>
                                </select>
                            </div>
                        </Section>

                        {/* Save Button */}
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-2.5 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50"
                            style={{ background: "linear-gradient(135deg, #7170ff, #7c3aed)" }}
                        >
                            {saving ? "Saving..." : "Save Escalation Config"}
                        </button>
                    </div>
                )}

                {/* Active Escalations Tab */}
                {tab === "active" && (
                    <div className="space-y-3">
                        {active.length === 0 ? (
                            <div className="text-center py-12">
                                <Shield className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
                                <p className="text-sm text-zinc-400">No active escalations. All clear.</p>
                            </div>
                        ) : active.map((esc) => (
                            <EscalationCard key={esc.id} escalation={esc} onAcknowledge={() => handleAck(esc.incident_id)} />
                        ))}
                    </div>
                )}

                {/* History Tab */}
                {tab === "history" && (
                    <div className="space-y-3">
                        {history.length === 0 ? (
                            <div className="text-center py-12">
                                <Clock className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
                                <p className="text-sm text-zinc-500">No escalation history yet.</p>
                            </div>
                        ) : history.map((esc) => (
                            <EscalationCard key={esc.id} escalation={esc} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function EscalationCard({ escalation, onAcknowledge }: { escalation: ActiveEscalation; onAcknowledge?: () => void }) {
    return (
        <div className="rounded-lg bg-zinc-900/50 border border-zinc-800 p-4">
            <div className="flex items-center justify-between mb-3">
                <div>
                    <p className="text-[13px] font-semibold text-zinc-100">{escalation.incident_title}</p>
                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{escalation.id} · {escalation.incident_id} · Level {escalation.current_level}/5</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${escalation.status === "active" ? "bg-red-500/10 text-red-400" : escalation.status === "acknowledged" ? "bg-emerald-500/10 text-emerald-400" : "bg-purple-500/10 text-purple-400"}`}>
                        {escalation.status}
                    </span>
                    {onAcknowledge && escalation.status === "active" && (
                        <button onClick={onAcknowledge} className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold bg-emerald-500 text-white rounded-md hover:bg-emerald-400">
                            <Check className="w-3 h-3" />Acknowledge
                        </button>
                    )}
                </div>
            </div>
            {/* Steps timeline */}
            <div className="space-y-1.5">
                {escalation.steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px]">
                        <span className={`w-1.5 h-1.5 rounded-full ${step.status === "sent" ? "bg-emerald-400" : step.status === "failed" ? "bg-red-400" : "bg-zinc-500"}`} />
                        <span className="text-zinc-500 font-mono w-16 shrink-0">L{step.level} {step.channel}</span>
                        <span className="text-zinc-400 truncate">{step.target || "system"}</span>
                        <span className={`shrink-0 ${step.status === "sent" ? "text-emerald-400" : step.status === "failed" ? "text-red-400" : "text-zinc-500"}`}>{step.status}</span>
                        {step.error_msg && <span className="text-red-400 text-[9px] truncate">{step.error_msg}</span>}
                    </div>
                ))}
            </div>
            {escalation.acknowledged_by && (
                <p className="text-[10px] text-emerald-400 mt-2">Acknowledged by {escalation.acknowledged_by} at {escalation.acknowledged_at}</p>
            )}
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
            <p className="text-[12px] font-semibold text-zinc-200 mb-3">{title}</p>
            <div className="space-y-3">{children}</div>
        </div>
    );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
    return (
        <div>
            <label className="text-[10px] text-[#64748b] block mb-1">{label}</label>
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full h-8 px-3 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] text-[11px] text-[#f7f8f8] placeholder:text-[rgba(15,23,42,0.20)] focus:outline-none focus:border-[#7170ff]/50"
            />
        </div>
    );
}
