"use client";

import { useEffect, useState } from "react";
import {
    getRiskSummary,
    getRiskScores,
    getRiskPredictions,
    analyzeServiceRisk,
    type RiskSummaryResponse,
    type ServiceRisk,
    type RiskPrediction,
} from "@/lib/api";
import { AlertTriangle, Shield, TrendingUp, Loader2, WifiOff, Sparkles, Clock, ChevronDown } from "lucide-react";

export default function RisksPage() {
    const [summary, setSummary] = useState<RiskSummaryResponse | null>(null);
    const [scores, setScores] = useState<ServiceRisk[]>([]);
    const [predictions, setPredictions] = useState<RiskPrediction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [analyzing, setAnalyzing] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<any>(null);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000); // refresh every 30s
        return () => clearInterval(interval);
    }, []);

    async function fetchData() {
        try {
            const [summaryData, scoresData, predictionsData] = await Promise.all([
                getRiskSummary().catch(() => null),
                getRiskScores().catch(() => ({ services: [], total: 0, calculated_at: "" })),
                getRiskPredictions().catch(() => ({ predictions: [], total: 0 })),
            ]);
            if (summaryData) setSummary(summaryData);
            setScores(scoresData.services || []);
            setPredictions(predictionsData.predictions || []);
            setError(null);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleAnalyze(service: string, namespace: string) {
        setAnalyzing(service);
        try {
            const result = await analyzeServiceRisk(service, namespace);
            setAnalysisResult(result);
        } catch (e: any) {
            alert(`Analysis failed: ${e.message}`);
        } finally {
            setAnalyzing(null);
        }
    }

    return (
        <div className="flex-1 overflow-y-auto scrollbar bg-[rgba(255,255,255,0.02)]">
            <div className="px-4 pt-4 pb-6 space-y-3">
                {/* Error banner */}
                {error && !loading && (
                    <div className="flex items-center gap-3 px-4 py-2.5 rounded-md bg-amber-500/5 border border-amber-500/15">
                        <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
                        <p className="text-xs text-amber-300">Backend offline — showing cached data.</p>
                    </div>
                )}

                {/* Stats Row */}
                {summary && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        <StatCard label="Overall Risk Score" value={summary.overall_score} suffix="/100" badge={summary.overall_level} color={levelColor(summary.overall_level)} />
                        <StatCard label="Services at Risk" value={summary.total_services_at_risk} badge={`${summary.critical_count} critical`} color="#f85149" />
                        <StatCard label="Prevented Incidents" value={summary.prevented_incidents} badge="Good" color="#3fb950" />
                        <StatCard label="AI Confidence" value={summary.ai_confidence} suffix="%" badge="High" color="#a371f7" />
                        <StatCard label="Trend" value={summary.trend} badge={summary.trend === "increasing" ? "↗ Rising" : summary.trend === "decreasing" ? "↘ Falling" : "→ Stable"} color={summary.trend === "increasing" ? "#f85149" : summary.trend === "decreasing" ? "#3fb950" : "#f0883e"} />
                    </div>
                )}

                {loading && !summary && (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-5 h-5 text-zinc-500 animate-spin mr-2" />
                        <span className="text-sm text-zinc-500">Calculating risk scores...</span>
                    </div>
                )}

                {/* Predictions */}
                {predictions.length > 0 && (
                    <div className="rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="w-4 h-4 text-purple-400" />
                            <h3 className="text-[14px] font-semibold text-[#f7f8f8]">AI Predictions — What Will Fail Next</h3>
                        </div>
                        <div className="space-y-2">
                            {predictions.map((p, i) => (
                                <div key={i} className="flex items-center gap-3 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] p-3">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${probabilityColor(p.probability)}15`, border: `1px solid ${probabilityColor(p.probability)}40` }}>
                                        <AlertTriangle className="w-4 h-4" style={{ color: probabilityColor(p.probability) }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[12px] font-semibold text-[#f7f8f8]">{p.service}</span>
                                            <span className="text-[10px] text-[#64748b] font-mono">{p.namespace}</span>
                                            <span className="flex items-center gap-1 text-[10px]" style={{ color: probabilityColor(p.probability) }}>
                                                <Clock className="w-3 h-3" />{p.time_horizon}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-[#64748b] mt-0.5 truncate">{p.predicted_issue}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-[14px] font-bold font-mono" style={{ color: probabilityColor(p.probability) }}>{Math.round(p.probability * 100)}%</p>
                                        <p className="text-[9px] text-[#64748b]">probability</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Categories (from summary) */}
                {summary && Object.keys(summary.categories).length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-3">
                        {/* Service Risk Table */}
                        <div className="rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-[14px] font-semibold text-[#f7f8f8]">Service Risk Scores</h3>
                                <span className="text-[10px] text-[#64748b]">{scores.length} services analyzed</span>
                            </div>
                            <div className="space-y-2">
                                {scores.slice(0, 15).map((s) => (
                                    <div key={`${s.namespace}/${s.service}`} className="flex items-center gap-3 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] p-3 hover:border-[rgba(15,23,42,0.14)] transition-colors">
                                        <div className="w-10 text-center shrink-0">
                                            <p className="text-[16px] font-bold font-mono" style={{ color: levelColor(s.risk_level) }}>{s.risk_score}</p>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[12px] font-medium text-[#f7f8f8]">{s.service}</span>
                                                <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold" style={{ background: `${levelColor(s.risk_level)}18`, color: levelColor(s.risk_level) }}>{s.risk_level}</span>
                                            </div>
                                            <p className="text-[10px] text-[#64748b] mt-0.5 truncate">{s.prediction}</p>
                                        </div>
                                        <div className="w-24 h-1.5 rounded-full bg-[rgba(15,23,42,0.10)] overflow-hidden shrink-0">
                                            <div className="h-full rounded-full" style={{ width: `${s.risk_score}%`, background: levelColor(s.risk_level) }} />
                                        </div>
                                        <button
                                            onClick={() => handleAnalyze(s.service, s.namespace)}
                                            disabled={analyzing === s.service}
                                            className="text-[10px] text-[#7170ff] hover:text-[#79c0ff] shrink-0 disabled:opacity-50"
                                        >
                                            {analyzing === s.service ? "..." : "Analyze"}
                                        </button>
                                    </div>
                                ))}
                                {scores.length === 0 && !loading && (
                                    <div className="text-center py-8 text-[12px] text-[#64748b]">
                                        No services detected. Connect to a cluster to see risk scores.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Risk Categories */}
                        <div className="rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-4">
                            <h3 className="text-[13px] font-semibold text-[#f7f8f8] mb-3">Risk Categories</h3>
                            <div className="space-y-3">
                                {Object.entries(summary.categories).map(([cat, count]) => (
                                    <div key={cat} className="flex items-center gap-3">
                                        <Shield className="w-4 h-4 text-[#f0883e] shrink-0" />
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] text-[#f7f8f8] font-medium">{cat}</span>
                                                <span className="text-[10px] font-mono text-[#f0883e]">{count}</span>
                                            </div>
                                            <div className="w-full h-1 rounded-full bg-[rgba(15,23,42,0.10)] overflow-hidden mt-1">
                                                <div className="h-full rounded-full bg-[#f0883e]" style={{ width: `${Math.min(100, (count / Math.max(...Object.values(summary.categories))) * 100)}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Top Risks */}
                            <h3 className="text-[13px] font-semibold text-[#f7f8f8] mt-6 mb-3">Top Risks</h3>
                            <div className="space-y-2">
                                {summary.top_risks.map((r, i) => (
                                    <div key={i} className="rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] p-2.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] text-[#f7f8f8] font-medium">{r.service}</span>
                                            <span className="text-[10px] font-mono font-bold" style={{ color: levelColor(r.level) }}>{r.score}</span>
                                        </div>
                                        <p className="text-[10px] text-[#64748b] mt-0.5 truncate">{r.top_factor}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* AI Analysis Result */}
                {analysisResult && (
                    <div className="rounded-[12px] border border-[#7170ff]/30 bg-[rgba(255,255,255,0.02)] p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-[#7170ff]" />
                                <h3 className="text-[14px] font-semibold text-[#f7f8f8]">AI Analysis — {analysisResult.service}</h3>
                            </div>
                            <button onClick={() => setAnalysisResult(null)} className="text-[#64748b] hover:text-[#f7f8f8]">✕</button>
                        </div>
                        <p className="text-[12px] text-[#f7f8f8] mb-3">{analysisResult.analysis?.summary}</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                            <div className="rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] p-2 text-center">
                                <p className="text-[9px] text-[#64748b]">Risk Score</p>
                                <p className="text-[18px] font-bold font-mono" style={{ color: levelColor(analysisResult.analysis?.risk_level || "medium") }}>{analysisResult.analysis?.risk_score}</p>
                            </div>
                            <div className="rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] p-2 text-center">
                                <p className="text-[9px] text-[#64748b]">Level</p>
                                <p className="text-[14px] font-bold" style={{ color: levelColor(analysisResult.analysis?.risk_level || "medium") }}>{analysisResult.analysis?.risk_level}</p>
                            </div>
                            <div className="rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] p-2 text-center">
                                <p className="text-[9px] text-[#64748b]">Time to Failure</p>
                                <p className="text-[14px] font-bold text-[#f0883e]">{analysisResult.analysis?.time_to_failure || "Unknown"}</p>
                            </div>
                            <div className="rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] p-2 text-center">
                                <p className="text-[9px] text-[#64748b]">Model</p>
                                <p className="text-[11px] font-mono text-[#64748b]">{analysisResult.model}</p>
                            </div>
                        </div>
                        {analysisResult.analysis?.recommended_actions?.length > 0 && (
                            <div>
                                <p className="text-[10px] text-[#64748b] font-semibold mb-2">Recommended Actions</p>
                                <div className="space-y-1.5">
                                    {analysisResult.analysis.recommended_actions.map((a: any, i: number) => (
                                        <div key={i} className="flex items-center gap-2 text-[11px]">
                                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${a.priority === "high" ? "bg-red-400" : a.priority === "medium" ? "bg-amber-400" : "bg-green-400"}`} />
                                            <span className="text-[#f7f8f8]">{a.action}</span>
                                            <span className="text-[#64748b]">— {a.impact}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function StatCard({ label, value, suffix, badge, color }: { label: string; value: string | number; suffix?: string; badge: string; color: string }) {
    return (
        <div className="rounded-[10px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3" style={{ background: `radial-gradient(circle at 85% 25%, ${color}15 0%, transparent 55%), rgba(255,255,255,0.02)` }}>
            <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10.5px] text-[#64748b] font-medium">{label}</p>
                <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold" style={{ background: `${color}18`, color }}>{badge}</span>
            </div>
            <div className="flex items-baseline gap-0.5">
                <span className="text-[24px] font-bold text-[#f7f8f8] leading-none font-mono">{value}</span>
                {suffix && <span className="text-[12px] text-[#94a3b8]">{suffix}</span>}
            </div>
        </div>
    );
}

function levelColor(level: string): string {
    switch (level) {
        case "critical": return "#f85149";
        case "high": return "#f0883e";
        case "medium": return "#f0883e";
        case "low": return "#3fb950";
        default: return "#64748b";
    }
}

function probabilityColor(prob: number): string {
    if (prob >= 0.75) return "#f85149";
    if (prob >= 0.5) return "#f0883e";
    if (prob >= 0.25) return "#f0883e";
    return "#3fb950";
}
