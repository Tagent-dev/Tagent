"use client";

import { useEffect, useState } from "react";
import {
    getIntegrations, testIntegration, getIntegrationConfig, saveIntegrationConfig, deleteIntegrationConfig,
    type IntegrationInfo, type IntegrationConfigResponse,
} from "@/lib/api";
import {
    Loader2, CheckCircle, XCircle, RefreshCw,
    Settings, Zap, Search, ArrowRight, Unplug, Eye, EyeOff,
} from "lucide-react";

// ===== Integration Brand Icons (SVG) =====

function SlackIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" fill="#E01E5A" />
            <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" fill="#36C5F0" />
            <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" fill="#2EB67D" />
            <path d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="#ECB22E" />
        </svg>
    );
}

function PagerDutyIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
            <path d="M15.69 0H5.58v17.76h3.72V12.9h5.85c4.2 0 6.87-2.43 6.87-6.42C22.02 2.55 19.89 0 15.69 0zm-.48 9.54H9.3V3.36h5.91c2.46 0 3.69 1.17 3.69 3.06 0 2.04-1.38 3.12-3.69 3.12zM5.58 20.88h3.72V24H5.58v-3.12z" fill="#06AC38" />
        </svg>
    );
}

function JiraIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
            <path d="M11.53 2c0 4.97 3.04 8.53 8.47 8.53h2V13H11.53C5.47 13 2 9.53 2 3.47V2h9.53z" fill="#2684FF" />
            <path d="M12.47 22c0-4.97-3.04-8.53-8.47-8.53H2V11h10.47C18.53 11 22 14.47 22 20.53V22h-9.53z" fill="#2684FF" />
        </svg>
    );
}

function TeamsIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
            <path d="M20.625 8.25h-4.5a.375.375 0 0 0-.375.375v6.75a2.625 2.625 0 0 1-2.625 2.625H9.75v.375c0 1.036.84 1.875 1.875 1.875h5.25l3 2.25v-2.25h.75c1.036 0 1.875-.84 1.875-1.875V10.125c0-1.036-.84-1.875-1.875-1.875z" fill="#5059C9" />
            <path d="M15.375 5.25H4.125C3.09 5.25 2.25 6.09 2.25 7.125v7.5c0 1.036.84 1.875 1.875 1.875h5.25l3 2.25V16.5h2.625c1.036 0 1.875-.84 1.875-1.875V7.125c0-1.036-.84-1.875-1.875-1.875z" fill="#7B83EB" />
            <circle cx="19.5" cy="5.25" r="2.25" fill="#5059C9" />
            <circle cx="9.75" cy="3" r="2.25" fill="#7B83EB" />
        </svg>
    );
}

function EmailIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
            <rect x="2" y="4" width="20" height="16" rx="2" stroke="#f0883e" strokeWidth="2" />
            <path d="M2 7l10 6 10-6" stroke="#f0883e" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

function OpsgenieIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
            <path d="M12 2L4 6v6c0 5.25 3.41 10.16 8 11.33 4.59-1.17 8-6.08 8-11.33V6l-8-4z" fill="#0052CC" />
            <path d="M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" fill="white" />
            <path d="M12 15c-2.5 0-4.5 1-4.5 2.5S9.5 20 12 20s4.5-1 4.5-2.5S14.5 15 12 15z" fill="white" fillOpacity="0.6" />
        </svg>
    );
}

function TwilioIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 20.077c-4.459 0-8.077-3.618-8.077-8.077S7.541 3.923 12 3.923s8.077 3.618 8.077 8.077-3.618 8.077-8.077 8.077z" fill="#F22F46" />
            <circle cx="9.5" cy="9.5" r="2" fill="#F22F46" />
            <circle cx="14.5" cy="9.5" r="2" fill="#F22F46" />
            <circle cx="9.5" cy="14.5" r="2" fill="#F22F46" />
            <circle cx="14.5" cy="14.5" r="2" fill="#F22F46" />
        </svg>
    );
}

function GithubIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
        </svg>
    );
}

function GitlabIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
            <path d="M12 21.35L1.895 14.53l1.928-5.932L5.89 2.568l2.054 6.03h8.11l2.054-6.03 2.068 6.03 1.928 5.932L12 21.35z" fill="#FC6D26" />
            <path d="M12 21.35l-4.055-12.75h8.11L12 21.35z" fill="#E24329" />
            <path d="M1.895 14.53L12 21.35 7.945 8.6H3.823l-1.928 5.93z" fill="#FCA326" />
            <path d="M22.105 14.53L12 21.35l4.055-12.75h4.122l1.928 5.93z" fill="#FCA326" />
        </svg>
    );
}

function WebhookIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="5" r="3" stroke="#a371f7" strokeWidth="2" />
            <circle cx="5" cy="19" r="3" stroke="#a371f7" strokeWidth="2" />
            <circle cx="19" cy="19" r="3" stroke="#a371f7" strokeWidth="2" />
            <path d="M12 8v4M8.5 17l2.5-4M15.5 17l-2.5-4" stroke="#a371f7" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

function KafkaIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="7" r="3" stroke="#f7f8f8" strokeWidth="1.5" />
            <circle cx="7" cy="14" r="2.5" stroke="#f7f8f8" strokeWidth="1.5" />
            <circle cx="17" cy="14" r="2.5" stroke="#f7f8f8" strokeWidth="1.5" />
            <circle cx="12" cy="19" r="2" stroke="#f7f8f8" strokeWidth="1.5" />
            <path d="M12 10v2M9.5 13l-1-1M14.5 13l1-1M10 16l1.5 1.5M14 16l-1.5 1.5" stroke="#f7f8f8" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

function getIntegrationIcon(id: string): React.ReactNode {
    const size = "w-7 h-7";
    switch (id) {
        case "slack": return <SlackIcon className={size} />;
        case "pagerduty": return <PagerDutyIcon className={size} />;
        case "jira": return <JiraIcon className={size} />;
        case "teams": return <TeamsIcon className={size} />;
        case "email": return <EmailIcon className={size} />;
        case "opsgenie": return <OpsgenieIcon className={size} />;
        case "twilio": return <TwilioIcon className={size} />;
        case "github": return <GithubIcon className={`${size} text-[#f7f8f8]`} />;
        case "gitlab": return <GitlabIcon className={size} />;
        case "webhook": return <WebhookIcon className={size} />;
        case "kafka": return <KafkaIcon className={size} />;
        default: return <Zap className={`${size} text-slate-400`} />;
    }
}

function getIntegrationDescription(id: string): string {
    switch (id) {
        case "slack": return "Send alerts, incident notifications, and AI briefings to Slack channels.";
        case "pagerduty": return "Trigger PagerDuty incidents for critical alerts with auto-resolve.";
        case "jira": return "Create Jira tickets for incidents and track remediation progress.";
        case "teams": return "Post notifications to Microsoft Teams channels via webhooks.";
        case "email": return "Send alert emails via SMTP for critical and high-severity incidents.";
        case "opsgenie": return "Route alerts to Opsgenie for on-call scheduling and escalation.";
        case "twilio": return "Phone call and SMS alerts for the escalation chain.";
        case "github": return "Track deployments, create issues, and correlate releases with incidents.";
        case "gitlab": return "Track deployments, create issues from incidents.";
        case "webhook": return "Send alert payloads to custom HTTP endpoints.";
        case "kafka": return "Publish events to Kafka topics for downstream processing.";
        default: return "External service integration.";
    }
}

// ===== Main Page =====

export default function IntegrationsPage() {
    const [integrations, setIntegrations] = useState<IntegrationInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [testing, setTesting] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [configModal, setConfigModal] = useState<string | null>(null);
    const [configData, setConfigData] = useState<IntegrationConfigResponse | null>(null);
    const [configLoading, setConfigLoading] = useState(false);

    useEffect(() => {
        loadIntegrations();
    }, []);

    async function loadIntegrations() {
        setLoading(true);
        try {
            const data = await getIntegrations();
            setIntegrations(data.integrations || []);
            setError(null);
        } catch (e: any) {
            setError(e.message || "Cannot reach notification service");
        } finally {
            setLoading(false);
        }
    }

    async function handleTest(id: string) {
        setTesting(id);
        try {
            await testIntegration(id);
            await loadIntegrations();
        } catch { }
        finally { setTesting(null); }
    }

    async function openConfig(id: string) {
        setConfigModal(id);
        setConfigLoading(true);
        try {
            const data = await getIntegrationConfig(id);
            setConfigData(data);
        } catch {
            setConfigData(null);
        }
        setConfigLoading(false);
    }

    const connected = integrations.filter(i => i.configured);
    const available = integrations.filter(i => !i.configured);

    return (
        <div className="flex-1 overflow-y-auto bg-[rgba(255,255,255,0.02)]">
            {/* Header */}
            <header className="px-6 py-5 border-b border-[rgba(15,23,42,0.10)]">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center">
                            <Zap className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold text-[#f7f8f8]">Integrations Command Center</h1>
                            <p className="text-xs text-[#64748b] mt-0.5">Configure, test and manage all your notification and escalation integrations.</p>
                        </div>
                    </div>
                    <button onClick={loadIntegrations} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium text-slate-300 bg-[rgba(15,23,42,0.10)] border border-[rgba(15,23,42,0.14)] hover:border-[rgba(15,23,42,0.20)] transition-colors">
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </button>
                </div>
            </header>

            <div className="px-6 py-5 space-y-6">
                {/* Stats Bar */}
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-[#f7f8f8]">Integrations</span>
                        <span className="text-[11px] text-[#64748b]">{connected.length} connected · {available.length} available</span>
                    </div>
                    <div className="flex-1" />
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94a3b8]" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search integrations..."
                            className="w-[200px] h-8 pl-8 pr-3 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] text-[11px] text-[#f7f8f8] placeholder:text-[#94a3b8] focus:outline-none focus:border-[#7170ff]/50"
                        />
                    </div>
                </div>

                {/* Error State */}
                {error && integrations.length === 0 && (
                    <div className="text-center py-16">
                        <Unplug className="w-12 h-12 text-[rgba(15,23,42,0.20)] mx-auto mb-4" />
                        <p className="text-sm text-[#64748b]">Cannot reach notification service</p>
                        <p className="text-xs text-[#94a3b8] mt-1">Make sure the notification service is running and accessible.</p>
                        <button onClick={loadIntegrations} className="mt-4 px-4 py-2 rounded-md text-[11px] font-medium text-blue-300 border border-blue-500/30 hover:bg-blue-500/10 transition-colors">
                            Retry Connection
                        </button>
                    </div>
                )}

                {/* Connected Integrations */}
                {connected.length > 0 && (
                    <div>
                        <h2 className="text-[12px] font-semibold text-[#3fb950] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <CheckCircle className="w-3.5 h-3.5" /> Connected ({connected.length})
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {connected.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase())).map(int => (
                                <IntegrationCard key={int.id} integration={int} onTest={handleTest} testing={testing} onConfigure={openConfig} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Available Integrations */}
                {available.length > 0 && (
                    <div>
                        <h2 className="text-[12px] font-semibold text-[#64748b] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <XCircle className="w-3.5 h-3.5" /> Available ({available.length})
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {available.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase())).map(int => (
                                <IntegrationCard key={int.id} integration={int} onTest={handleTest} testing={testing} onConfigure={openConfig} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Loading State */}
                {loading && integrations.length === 0 && (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                        <span className="ml-2 text-sm text-[#64748b]">Loading integrations...</span>
                    </div>
                )}
            </div>

            {/* Configuration Modal */}
            {configModal && (
                <ConfigModal
                    integrationId={configModal}
                    data={configData}
                    loading={configLoading}
                    onClose={() => { setConfigModal(null); setConfigData(null); }}
                    onSaved={() => { setConfigModal(null); setConfigData(null); loadIntegrations(); }}
                />
            )}
        </div>
    );
}

// ===== Integration Card =====
function IntegrationCard({ integration, onTest, testing, onConfigure }: {
    integration: IntegrationInfo;
    onTest: (id: string) => void;
    testing: string | null;
    onConfigure: (id: string) => void;
}) {
    const isConnected = integration.configured;
    const isTesting = testing === integration.id;

    return (
        <div className={`rounded-xl border p-4 transition-colors hover:border-[rgba(15,23,42,0.20)] ${isConnected ? "border-green-500/20 bg-[rgba(255,255,255,0.02)]" : "border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)]"}`}>
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] flex items-center justify-center p-1.5">
                        {getIntegrationIcon(integration.id)}
                    </div>
                    <div>
                        <p className="text-[13px] font-semibold text-[#f7f8f8]">{integration.name}</p>
                        <p className="text-[10px] text-[#94a3b8]">{integration.setup_type}</p>
                    </div>
                </div>
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold ${isConnected ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-[rgba(15,23,42,0.10)] text-[#94a3b8] border border-[rgba(15,23,42,0.14)]"}`}>
                    {isConnected ? "Connected" : "Not configured"}
                </span>
            </div>

            <p className="text-[11px] text-[#64748b] mb-3 leading-relaxed">
                {getIntegrationDescription(integration.id)}
            </p>

            {/* Health indicator */}
            {isConnected && (
                <div className="flex items-center gap-1.5 mb-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-[10px] text-green-400">Healthy</span>
                    {integration.last_sync && (
                        <span className="text-[10px] text-[#94a3b8] ml-2">Last sync: {integration.last_sync}</span>
                    )}
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-[rgba(15,23,42,0.10)]">
                <button
                    onClick={() => onConfigure(integration.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-slate-300 bg-[rgba(15,23,42,0.10)] border border-[rgba(15,23,42,0.14)] rounded-md hover:border-[rgba(15,23,42,0.20)] hover:text-[#f7f8f8] transition-colors"
                >
                    <Settings className="w-3 h-3" />
                    Configure
                </button>
                {isConnected && (
                    <button
                        onClick={() => onTest(integration.id)}
                        disabled={isTesting}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded-md hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                    >
                        {isTesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                        {isTesting ? "Testing..." : "Test"}
                    </button>
                )}
                {!isConnected && (
                    <button
                        onClick={() => onConfigure(integration.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded-md hover:bg-blue-500/20 transition-colors"
                    >
                        <ArrowRight className="w-3 h-3" />
                        Set Up
                    </button>
                )}
            </div>
        </div>
    );
}

// ===== Configuration Modal =====
function ConfigModal({ integrationId, data, loading, onClose, onSaved }: {
    integrationId: string;
    data: IntegrationConfigResponse | null;
    loading: boolean;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [values, setValues] = useState<Record<string, string>>({});
    const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (data?.saved) {
            setValues(data.saved);
        }
    }, [data]);

    async function handleSave() {
        setSaving(true);
        try {
            await saveIntegrationConfig(integrationId, values);
            onSaved();
        } catch { }
        setSaving(false);
    }

    async function handleDelete() {
        try {
            await deleteIntegrationConfig(integrationId);
            onSaved();
        } catch { }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-lg rounded-xl border border-[rgba(15,23,42,0.14)] bg-[rgba(255,255,255,0.02)] shadow-2xl" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(15,23,42,0.10)]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] flex items-center justify-center p-1">
                            {getIntegrationIcon(integrationId)}
                        </div>
                        <div>
                            <p className="text-[13px] font-semibold text-[#f7f8f8]">Configure {data?.integration?.name || integrationId}</p>
                            <p className="text-[10px] text-[#94a3b8]">{data?.integration?.setup_type || ""}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-[#64748b] hover:text-[#f7f8f8] transition-colors">
                        <XCircle className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                        </div>
                    ) : data?.integration?.fields ? (
                        data.integration.fields.map(field => (
                            <div key={field.key}>
                                <label className="text-[11px] font-medium text-[#64748b] flex items-center gap-1">
                                    {field.label}
                                    {field.required && <span className="text-red-400">*</span>}
                                </label>
                                <div className="relative mt-1">
                                    <input
                                        type={field.secret && !showSecrets[field.key] ? "password" : "text"}
                                        value={values[field.key] || ""}
                                        onChange={e => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                                        placeholder={field.placeholder}
                                        className="w-full h-9 px-3 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] text-[12px] text-[#f7f8f8] font-mono placeholder:text-[rgba(15,23,42,0.20)] focus:outline-none focus:border-[#7170ff]/50"
                                    />
                                    {field.secret && (
                                        <button
                                            type="button"
                                            onClick={() => setShowSecrets(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#f7f8f8]"
                                        >
                                            {showSecrets[field.key] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-[11px] text-[#64748b] text-center py-4">
                            Configuration not available. Set environment variables directly.
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-[rgba(15,23,42,0.10)]">
                    {data?.configured && (
                        <button onClick={handleDelete} className="px-3 py-1.5 text-[11px] font-medium text-red-400 border border-red-500/20 rounded-md hover:bg-red-500/10 transition-colors">
                            Disconnect
                        </button>
                    )}
                    {!data?.configured && <div />}
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} className="px-3 py-1.5 text-[11px] font-medium text-[#64748b] border border-[rgba(15,23,42,0.14)] rounded-md hover:text-[#f7f8f8] transition-colors">
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-4 py-1.5 text-[11px] font-medium text-white bg-[#238636] rounded-md hover:bg-[#2ea043] transition-colors disabled:opacity-50"
                        >
                            {saving ? "Saving..." : "Save & Connect"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
