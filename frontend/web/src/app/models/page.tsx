"use client";

import { useEffect, useState, useCallback } from "react";
import {
    getModelCatalog,
    getInstalledModels,
    getActiveModel,
    pullModel,
    getPullStatus,
    switchModel,
    deleteModel,
    getCloudKeys,
    storeCloudKey,
    deleteCloudKey,
    type LocalModelInfo,
    type InstalledModel,
    type ActiveModelResponse,
    type CloudKeyStatus,
} from "@/lib/api";
import {
    Download, Trash2, Check, Loader2, AlertCircle,
    Server, Zap, Brain, HardDrive, RefreshCw,
    ChevronDown, ChevronRight, Star, Plus, Package, RotateCcw,
    Cloud, Eye, EyeOff, KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "installed" | "catalog" | "cloud";
type PullState = Record<string, { status: string; progress: number; error?: string | null }>;

export default function ModelsPage() {
    const [tab, setTab] = useState<Tab>("installed");
    const [catalog, setCatalog] = useState<LocalModelInfo[]>([]);
    const [installed, setInstalled] = useState<InstalledModel[]>([]);
    const [active, setActive] = useState<ActiveModelResponse | null>(null);
    const [pullStates, setPullStates] = useState<PullState>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedCategory, setExpandedCategory] = useState<string>("small");
    const [customModel, setCustomModel] = useState("");
    const [deletingModel, setDeletingModel] = useState<string | null>(null);
    const [ollamaReady, setOllamaReady] = useState(true);
    // Cloud provider (BYOK) state
    const [cloudKeys, setCloudKeys] = useState<CloudKeyStatus[]>([]);
    const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
    const [showKey, setShowKey] = useState<Record<string, boolean>>({});
    const [savingKey, setSavingKey] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            const catalogRes = await getModelCatalog();
            setCatalog(catalogRes.local_models);

            try {
                const [installedRes, activeRes] = await Promise.all([
                    getInstalledModels(),
                    getActiveModel(),
                ]);
                setInstalled(installedRes.models);
                setActive(activeRes);
                setOllamaReady(true);
            } catch {
                setInstalled([]);
                setOllamaReady(false);
            }

            try {
                const cloudRes = await getCloudKeys();
                setCloudKeys(cloudRes.providers);
            } catch {
                setCloudKeys([]);
            }

            setError(null);
        } catch (e: any) {
            setError(e.message || "Failed to load model data");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Poll pull status for active pulls
    useEffect(() => {
        const pullingModels = Object.entries(pullStates).filter(([_, s]) => s.status === "pulling");
        if (pullingModels.length === 0) return;

        const interval = setInterval(async () => {
            for (const [modelId] of pullingModels) {
                try {
                    const status = await getPullStatus(modelId);
                    setPullStates(prev => ({ ...prev, [modelId]: status }));
                    if (status.status === "ready" || status.status === "error") {
                        const res = await getInstalledModels();
                        setInstalled(res.models);
                    }
                } catch { /* ignore polling errors */ }
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [pullStates]);

    const handlePull = async (modelId: string) => {
        setPullStates(prev => ({ ...prev, [modelId]: { status: "pulling", progress: 0 } }));
        try {
            await pullModel(modelId);
        } catch (e: any) {
            setPullStates(prev => ({ ...prev, [modelId]: { status: "error", progress: 0, error: e.message } }));
        }
    };

    const handleCustomPull = async () => {
        if (!customModel.trim()) return;
        const modelId = customModel.trim();
        setCustomModel("");
        await handlePull(modelId);
    };

    const handleSwitch = async (modelId: string, type: "chat" | "embedding") => {
        try {
            await switchModel(modelId, type);
            setActive(prev => prev ? {
                ...prev,
                [type === "chat" ? "chat_model" : "embedding_model"]: modelId
            } : null);
        } catch (e: any) {
            setError(e.message);
        }
    };

    const handleDelete = async (modelId: string) => {
        setDeletingModel(modelId);
        try {
            await deleteModel(modelId);
            setInstalled(prev => prev.filter(m => m.id !== modelId));
            setPullStates(prev => { const n = { ...prev }; delete n[modelId]; return n; });
        } catch (e: any) {
            setError(e.message);
        } finally {
            setDeletingModel(null);
        }
    };

    const handleSaveCloudKey = async (providerId: string) => {
        const key = keyInputs[providerId]?.trim();
        if (!key) return;
        setSavingKey(providerId);
        try {
            await storeCloudKey(providerId, key);
            setCloudKeys(prev => prev.map(p => p.id === providerId ? { ...p, has_key: true } : p));
            setKeyInputs(prev => ({ ...prev, [providerId]: "" }));
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSavingKey(null);
        }
    };

    const handleDeleteCloudKey = async (providerId: string) => {
        setSavingKey(providerId);
        try {
            await deleteCloudKey(providerId);
            setCloudKeys(prev => prev.map(p => p.id === providerId ? { ...p, has_key: false } : p));
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSavingKey(null);
        }
    };

    const isInstalled = (modelId: string) => installed.some(m => m.id === modelId || m.id.startsWith(modelId.split(":")[0]));
    const isActive = (modelId: string) => active?.chat_model === modelId || active?.embedding_model === modelId;
    const totalDiskUsage = installed.reduce((sum, m) => sum + m.size, 0);

    const categories = [
        { key: "small", label: "Small Models", icon: Zap, desc: "< 4GB RAM — fast inference" },
        { key: "medium", label: "Medium Models", icon: Brain, desc: "4-10GB RAM — balanced" },
        { key: "large", label: "Large Models", icon: Server, desc: "10GB+ RAM — maximum capability" },
        { key: "embedding", label: "Embedding Models", icon: HardDrive, desc: "For vector search & RAG" },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                <span className="ml-3 text-slate-400">Loading model catalog...</span>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-[#f7f8f8] flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(113,112,255,0.12)", boxShadow: "inset 0 0 0 1px rgba(113,112,255,0.25)" }}>
                            <img src="/logos/ollama.svg" alt="Ollama" width={18} height={18} className="invert opacity-90" />
                        </span>
                        AI Model Management
                    </h1>
                    <p className="text-sm text-[#8a8f98] mt-1">
                        Install, switch, and manage AI models. Local models run entirely on your cluster via Ollama.
                    </p>
                </div>
                <button
                    onClick={() => { setLoading(true); fetchData(); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition"
                >
                    <RefreshCw className="w-4 h-4" /> Refresh
                </button>
            </div>

            {/* Active Model Banner */}
            {active && (
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Star className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-medium text-slate-200">Active Models</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Chat: <span className="text-blue-300 font-mono">{active.chat_model}</span>
                            {" · "}
                            Embedding: <span className="text-blue-300 font-mono">{active.embedding_model}</span>
                        </p>
                    </div>
                    <div className="text-xs text-slate-500">
                        {installed.length} models · {formatBytes(totalDiskUsage)} used
                    </div>
                </div>
            )}

            {/* Ollama starting up */}
            {!ollamaReady && !error && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-medium text-amber-200">Ollama is starting up...</p>
                        <p className="text-xs text-amber-300/60 mt-0.5">
                            The Ollama pod is still initializing. You can browse the catalog below.
                            Models will be installable once Ollama is ready (usually 30-60 seconds).
                        </p>
                    </div>
                    <button onClick={() => { setLoading(true); fetchData(); }} className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs hover:bg-amber-500/20 transition">
                        Retry
                    </button>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 flex items-center gap-2 text-red-300 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                    <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">✕</button>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 bg-navy-900/50 p-1 rounded-lg w-fit border border-white/5">
                <button
                    onClick={() => setTab("installed")}
                    className={cn(
                        "px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2",
                        tab === "installed" ? "bg-green-500/20 text-green-300 border border-green-500/30" : "text-slate-400 hover:text-slate-200"
                    )}
                >
                    <Package className="w-4 h-4" /> Installed ({installed.length})
                </button>
                <button
                    onClick={() => setTab("catalog")}
                    className={cn(
                        "px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2",
                        tab === "catalog" ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" : "text-slate-400 hover:text-slate-200"
                    )}
                >
                    <Server className="w-4 h-4" /> Model Catalog
                </button>
                <button
                    onClick={() => setTab("cloud")}
                    className={cn(
                        "px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2",
                        tab === "cloud" ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : "text-slate-400 hover:text-slate-200"
                    )}
                >
                    <Cloud className="w-4 h-4" /> Cloud API Keys
                </button>
            </div>

            {/* INSTALLED MODELS TAB */}
            {tab === "installed" && (
                <div className="space-y-4">
                    {/* Custom model pull */}
                    <div className="rounded-xl border border-white/5 bg-navy-900/30 p-4">
                        <p className="text-sm font-medium text-slate-200 mb-2 flex items-center gap-2">
                            <Plus className="w-4 h-4 text-blue-400" />
                            Pull a custom model
                        </p>
                        <p className="text-xs text-slate-500 mb-3">
                            Enter any Ollama model name (e.g. <code className="text-slate-400">codellama:7b</code>, <code className="text-slate-400">vicuna:13b</code>, <code className="text-slate-400">neural-chat</code>)
                        </p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={customModel}
                                onChange={e => setCustomModel(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && handleCustomPull()}
                                placeholder="model-name:tag (e.g. mistral:7b)"
                                className="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none font-mono"
                            />
                            <button
                                onClick={handleCustomPull}
                                disabled={!customModel.trim()}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-medium hover:bg-blue-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <Download className="w-3.5 h-3.5" /> Pull Model
                            </button>
                        </div>
                        {/* Active pull progress */}
                        {Object.entries(pullStates).filter(([_, s]) => s.status === "pulling").map(([modelId, state]) => (
                            <div key={modelId} className="mt-3 flex items-center gap-3 p-2 rounded-lg bg-blue-500/5 border border-blue-500/10">
                                <Loader2 className="w-4 h-4 animate-spin text-blue-400 shrink-0" />
                                <span className="text-xs text-slate-300 font-mono">{modelId}</span>
                                <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                                    <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${state.progress}%` }} />
                                </div>
                                <span className="text-xs text-blue-300 w-8">{state.progress}%</span>
                            </div>
                        ))}
                    </div>

                    {/* Installed models list */}
                    {installed.length === 0 ? (
                        <div className="rounded-xl border border-white/5 bg-navy-900/30 p-8 text-center">
                            <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                            <p className="text-sm text-slate-400">No models installed yet</p>
                            <p className="text-xs text-slate-500 mt-1">Go to the Model Catalog tab to install your first model</p>
                            <button onClick={() => setTab("catalog")} className="mt-4 px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-medium hover:bg-blue-500/20 transition">
                                Browse Catalog
                            </button>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-white/5 bg-navy-900/30 overflow-hidden">
                            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                                <p className="text-sm font-medium text-slate-200">
                                    {installed.length} model{installed.length !== 1 ? "s" : ""} installed
                                </p>
                                <p className="text-xs text-slate-500">
                                    Total disk usage: <span className="text-slate-300 font-mono">{formatBytes(totalDiskUsage)}</span>
                                </p>
                            </div>
                            <div className="divide-y divide-white/5">
                                {installed.map(model => {
                                    const modelActive = isActive(model.id);
                                    const isEmbedding = model.id.includes("embed") || model.id.includes("nomic");
                                    return (
                                        <div key={model.id} className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02] transition">
                                            <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                                                {isEmbedding ? <HardDrive className="w-4 h-4 text-purple-400" /> : <Brain className="w-4 h-4 text-blue-400" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-slate-200 font-mono">{model.id}</span>
                                                    {modelActive && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-500/30">ACTIVE</span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    {model.size_human} · {model.parameter_size || model.family || "unknown"} · {model.quantization || "default"}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {!modelActive && (
                                                    <button
                                                        onClick={() => handleSwitch(model.id, isEmbedding ? "embedding" : "chat")}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-300 text-xs font-medium hover:bg-green-500/20 transition"
                                                    >
                                                        <Check className="w-3.5 h-3.5" /> Activate
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        if (confirm(`Delete "${model.id}" (${model.size_human})?\n\nThis frees disk space. You can re-install it anytime from the catalog.`)) {
                                                            handleDelete(model.id);
                                                        }
                                                    }}
                                                    disabled={deletingModel === model.id}
                                                    className="flex items-center gap-1.5 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition disabled:opacity-40"
                                                    title={`Delete ${model.id}`}
                                                >
                                                    {deletingModel === model.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* MODEL CATALOG TAB */}
            {tab === "catalog" && (
                <div className="space-y-4">
                    <p className="text-xs text-slate-500">
                        Browse and install models. Click Install to download directly to your cluster.
                    </p>

                    {categories.map(cat => {
                        const models = catalog.filter(m => m.category === cat.key);
                        const isExpanded = expandedCategory === cat.key;
                        const installedCount = models.filter(m => isInstalled(m.id)).length;
                        return (
                            <div key={cat.key} className="rounded-xl border border-white/5 bg-navy-900/30 overflow-hidden">
                                <button
                                    onClick={() => setExpandedCategory(isExpanded ? "" : cat.key)}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition"
                                >
                                    <cat.icon className="w-5 h-5 text-slate-400" />
                                    <div className="flex-1 text-left">
                                        <span className="text-sm font-medium text-slate-200">{cat.label}</span>
                                        <span className="ml-2 text-xs text-slate-500">{cat.desc}</span>
                                    </div>
                                    <span className="text-xs text-slate-500 mr-2">
                                        {installedCount > 0 && <span className="text-green-400">{installedCount} installed · </span>}
                                        {models.length} models
                                    </span>
                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                                </button>

                                {isExpanded && (
                                    <div className="border-t border-white/5 divide-y divide-white/5">
                                        {models.map(model => {
                                            const modelInstalled = isInstalled(model.id);
                                            const modelActive = isActive(model.id);
                                            const pullState = pullStates[model.id];
                                            const isPulling = pullState?.status === "pulling";
                                            const pullError = pullState?.status === "error";

                                            return (
                                                <div key={model.id} className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02] transition">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-medium text-slate-200">{model.name}</span>
                                                            {model.default && (
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">DEFAULT</span>
                                                            )}
                                                            {modelActive && (
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-500/30">ACTIVE</span>
                                                            )}
                                                            {modelInstalled && !modelActive && (
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-400 border border-slate-500/30">INSTALLED</span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-500 mt-0.5">{model.description}</p>
                                                        <p className="text-[11px] text-slate-600 font-mono mt-0.5">{model.id} · {model.size}</p>
                                                    </div>

                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {isPulling && (
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-24 h-2 rounded-full bg-white/10 overflow-hidden">
                                                                    <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${pullState.progress}%` }} />
                                                                </div>
                                                                <span className="text-xs text-blue-300 w-8">{pullState.progress}%</span>
                                                                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                                                            </div>
                                                        )}

                                                        {pullError && (
                                                            <button onClick={() => handlePull(model.id)} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300">
                                                                <RotateCcw className="w-3 h-3" /> Retry
                                                            </button>
                                                        )}

                                                        {!modelInstalled && !isPulling && !pullError && (
                                                            <button
                                                                onClick={() => handlePull(model.id)}
                                                                disabled={!ollamaReady}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-medium hover:bg-blue-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
                                                            >
                                                                <Download className="w-3.5 h-3.5" /> Install
                                                            </button>
                                                        )}

                                                        {modelInstalled && !modelActive && (
                                                            <button
                                                                onClick={() => handleSwitch(model.id, model.category === "embedding" ? "embedding" : "chat")}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-300 text-xs font-medium hover:bg-green-500/20 transition"
                                                            >
                                                                <Check className="w-3.5 h-3.5" /> Activate
                                                            </button>
                                                        )}

                                                        {modelInstalled && (
                                                            <button
                                                                onClick={() => {
                                                                    if (confirm(`Delete "${model.id}" (${model.size})? You can re-install it anytime.`)) {
                                                                        handleDelete(model.id);
                                                                    }
                                                                }}
                                                                className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
                                                                title="Delete model"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* CLOUD API KEYS TAB (optional BYOK) */}
            {tab === "cloud" && (
                <div className="space-y-4">
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-amber-300">Optional — Cloud API Keys</p>
                            <p className="text-xs text-amber-300/70 mt-1">
                                Local models work fully offline with no key required. Add a cloud
                                provider key to route AI calls through that provider instead. Keys are
                                stored securely as Kubernetes Secrets. When a cloud provider is active,
                                prompts and cluster context are sent to that provider.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {cloudKeys.length === 0 && (
                            <div className="rounded-xl border border-white/5 bg-navy-900/30 p-8 text-center">
                                <Cloud className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                                <p className="text-sm text-slate-400">No cloud providers available</p>
                                <p className="text-xs text-slate-500 mt-1">The AI Engine did not return any cloud providers.</p>
                            </div>
                        )}
                        {cloudKeys.map(provider => (
                            <div key={provider.id} className="rounded-xl border border-white/5 bg-navy-900/30 p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                                        <Cloud className="w-4 h-4 text-purple-400" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-slate-200">{provider.name}</span>
                                            {provider.has_key ? (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-500/30">CONNECTED</span>
                                            ) : (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-400 border border-slate-500/30">NOT CONFIGURED</span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-0.5 font-mono">{provider.models.join(" · ")}</p>
                                    </div>
                                    {provider.has_key && (
                                        <button
                                            onClick={() => handleDeleteCloudKey(provider.id)}
                                            disabled={savingKey === provider.id}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-red-400 hover:bg-red-500/10 border border-red-500/30 text-xs transition disabled:opacity-40"
                                        >
                                            {savingKey === provider.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Remove
                                        </button>
                                    )}
                                </div>
                                {!provider.has_key && (
                                    <div className="mt-3 flex gap-2">
                                        <div className="relative flex-1">
                                            <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                            <input
                                                type={showKey[provider.id] ? "text" : "password"}
                                                value={keyInputs[provider.id] || ""}
                                                onChange={e => setKeyInputs(prev => ({ ...prev, [provider.id]: e.target.value }))}
                                                onKeyDown={e => e.key === "Enter" && handleSaveCloudKey(provider.id)}
                                                placeholder={`${provider.name} API key`}
                                                className="w-full pl-9 pr-10 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-slate-200 placeholder:text-slate-600 focus:border-purple-500/50 focus:outline-none font-mono"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowKey(prev => ({ ...prev, [provider.id]: !prev[provider.id] }))}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                                            >
                                                {showKey[provider.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => handleSaveCloudKey(provider.id)}
                                            disabled={!keyInputs[provider.id]?.trim() || savingKey === provider.id}
                                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-medium hover:bg-purple-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            {savingKey === provider.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save & Connect
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

        </div>
    );
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
