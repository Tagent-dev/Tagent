"use client";

import { useEffect, useState } from "react";
import {
    getKnowledgeEntries,
    getKnowledgeStats,
    searchKnowledge,
    autoIngestKnowledge,
    getKnowledgeRecommendations,
    type KnowledgeEntry,
    type KnowledgeStatsResponse,
    type KnowledgeRecommendation,
} from "@/lib/api";
import { Search, BookOpen, Loader2, WifiOff, RefreshCw, Sparkles, BarChart3, Tag } from "lucide-react";

export default function KnowledgePage() {
    const [q, setQ] = useState("");
    const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
    const [stats, setStats] = useState<KnowledgeStatsResponse | null>(null);
    const [recommendations, setRecommendations] = useState<KnowledgeRecommendation[]>([]);
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [ingesting, setIngesting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeCategory, setActiveCategory] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);
        try {
            const [entriesData, statsData] = await Promise.all([
                getKnowledgeEntries().catch(() => ({ entries: [], total: 0 })),
                getKnowledgeStats().catch(() => null),
            ]);
            setEntries(entriesData.entries || []);
            setStats(statsData);
            setError(null);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleSearch() {
        if (!q.trim()) {
            fetchData();
            return;
        }
        setSearching(true);
        try {
            const data = await searchKnowledge(q.trim());
            setEntries(data.results || []);
            setError(null);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSearching(false);
        }
    }

    async function handleAutoIngest() {
        setIngesting(true);
        try {
            const result = await autoIngestKnowledge();
            // Refresh data after ingest
            await fetchData();
            alert(`Ingested ${result.ingested} entries from live incidents.${result.errors?.length ? ` Errors: ${result.errors.length}` : ""}`);
        } catch (e: any) {
            alert(`Auto-ingest failed: ${e.message}`);
        } finally {
            setIngesting(false);
        }
    }

    async function handleRecommend() {
        if (!q.trim()) return;
        setSearching(true);
        try {
            const data = await getKnowledgeRecommendations(q.trim());
            setRecommendations(data.recommendations || []);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSearching(false);
        }
    }

    async function filterByCategory(cat: string | null) {
        setActiveCategory(cat);
        setLoading(true);
        try {
            const data = await getKnowledgeEntries(cat || undefined);
            setEntries(data.entries || []);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex-1 overflow-y-auto scrollbar bg-[rgba(255,255,255,0.02)]">
            <header className="px-6 py-5 border-b border-zinc-800/60">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-semibold text-zinc-100">Knowledge Base</h1>
                        <p className="text-sm text-zinc-500 mt-0.5">
                            {stats ? `${stats.total_entries} patterns stored` : "AI-powered incident memory with vector similarity search"}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {loading && <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />}
                        {error && <span className="flex items-center gap-1 text-[10px] text-amber-400"><WifiOff className="w-3 h-3" />offline</span>}
                        <button
                            onClick={handleAutoIngest}
                            disabled={ingesting}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md hover:bg-emerald-500/20 disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3 h-3 ${ingesting ? "animate-spin" : ""}`} />
                            {ingesting ? "Ingesting..." : "Auto-Ingest from Incidents"}
                        </button>
                    </div>
                </div>
            </header>

            <div className="px-6 py-5 space-y-4">
                {/* Stats Row */}
                {stats && stats.total_entries > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <StatCard label="Total Patterns" value={stats.total_entries} icon={<BookOpen className="w-4 h-4 text-emerald-400" />} />
                        <StatCard label="Categories" value={Object.keys(stats.categories).length} icon={<Tag className="w-4 h-4 text-blue-400" />} />
                        <StatCard label="Services Covered" value={stats.top_services.length} icon={<BarChart3 className="w-4 h-4 text-purple-400" />} />
                        <StatCard label="Top Service" value={stats.top_services[0]?.service || "—"} icon={<Sparkles className="w-4 h-4 text-amber-400" />} />
                    </div>
                )}

                {/* Category Filters */}
                {stats && Object.keys(stats.categories).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => filterByCategory(null)}
                            className={`px-2.5 py-1 text-[10px] font-medium rounded-full border transition-colors ${!activeCategory ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "text-zinc-500 border-zinc-800 hover:text-zinc-300"}`}
                        >
                            All
                        </button>
                        {Object.entries(stats.categories).map(([cat, count]) => (
                            <button
                                key={cat}
                                onClick={() => filterByCategory(cat)}
                                className={`px-2.5 py-1 text-[10px] font-medium rounded-full border transition-colors ${activeCategory === cat ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "text-zinc-500 border-zinc-800 hover:text-zinc-300"}`}
                            >
                                {cat} ({count})
                            </button>
                        ))}
                    </div>
                )}

                {/* Search + Recommend */}
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            placeholder="Search patterns or describe a problem..."
                            className="w-full h-9 bg-zinc-900 border border-zinc-800 rounded-md pl-9 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
                        />
                    </div>
                    <button
                        onClick={handleSearch}
                        disabled={searching}
                        className="px-3 h-9 text-[11px] font-medium text-zinc-200 bg-zinc-800 border border-zinc-700 rounded-md hover:bg-zinc-700 disabled:opacity-50"
                    >
                        {searching ? "..." : "Search"}
                    </button>
                    <button
                        onClick={handleRecommend}
                        disabled={searching || !q.trim()}
                        className="px-3 h-9 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md hover:bg-emerald-500/20 disabled:opacity-50 flex items-center gap-1"
                    >
                        <Sparkles className="w-3 h-3" />Recommend Fix
                    </button>
                </div>

                {/* Recommendations */}
                {recommendations.length > 0 && (
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4 space-y-3">
                        <p className="text-[12px] font-semibold text-emerald-400">AI Recommendations</p>
                        {recommendations.map((rec, i) => (
                            <div key={i} className="bg-zinc-900/80 rounded-md p-3 border border-zinc-800">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[12px] font-medium text-zinc-200">{rec.action} → {rec.target}</span>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${rec.risk === "low" ? "bg-emerald-500/10 text-emerald-400" : rec.risk === "medium" ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400"}`}>{rec.risk} risk</span>
                                        <span className="text-[10px] text-emerald-400 font-mono">{Math.round(rec.confidence * 100)}%</span>
                                    </div>
                                </div>
                                <p className="text-[11px] text-zinc-400">{rec.reasoning}</p>
                                {rec.knowledge_base_match && (
                                    <p className="text-[10px] text-zinc-500 mt-1">Based on: {rec.knowledge_base_match}</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Entries List */}
                {entries.length === 0 && !loading ? (
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg px-6 py-12 text-center">
                        <BookOpen className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                        <p className="text-sm text-zinc-500">
                            {error
                                ? "Start API Gateway and AI Engine to access the Knowledge Base."
                                : "No patterns stored yet. Click \"Auto-Ingest from Incidents\" to populate from live data."}
                        </p>
                    </div>
                ) : (
                    entries.map((entry) => (
                        <div key={entry.id} className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors">
                            <div className="flex items-start gap-3">
                                <BookOpen className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="text-[13px] text-zinc-200 font-medium truncate">{entry.title}</p>
                                        {entry.similarity != null && (
                                            <span className="text-[9px] text-emerald-400 font-mono shrink-0">{Math.round(entry.similarity * 100)}% match</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                                        <span className={`px-1.5 py-0.5 rounded ${entry.severity === "critical" ? "bg-red-500/10 text-red-400" : entry.severity === "high" ? "bg-orange-500/10 text-orange-400" : "bg-amber-500/10 text-amber-400"}`}>{entry.severity}</span>
                                        <span>{entry.category}</span>
                                        <span>·</span>
                                        <span>{entry.service}/{entry.namespace}</span>
                                        <span>·</span>
                                        <span>seen {entry.occurrence_count}x</span>
                                        <span>·</span>
                                        <span className="text-emerald-400">{Math.round(entry.success_rate * 100)}% fix rate</span>
                                    </div>
                                    <p className="text-[11px] text-zinc-500 mt-1.5">{entry.root_cause}</p>
                                    <p className="text-[11px] text-zinc-400 border-l-2 border-emerald-500/40 pl-2 mt-2">{entry.fix_action}</p>
                                    {entry.tags.length > 0 && (
                                        <div className="flex gap-1 mt-2">
                                            {entry.tags.slice(0, 5).map((tag) => (
                                                <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">{tag}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
    return (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
                {icon}
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</span>
            </div>
            <p className="text-[16px] font-bold text-zinc-100">{value}</p>
        </div>
    );
}
