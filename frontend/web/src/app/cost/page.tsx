"use client";

import { useState } from "react";
import { CostStatsRow } from "@/components/cost/CostStatsRow";
import { CostBreakdown } from "@/components/cost/CostBreakdown";
import { AICostInsights } from "@/components/cost/AICostInsights";
import { CostAnomalyDetection } from "@/components/cost/CostAnomalyDetection";
import { KubernetesCostHeatmap } from "@/components/cost/KubernetesCostHeatmap";
import { ResourceEfficiencyCenter } from "@/components/cost/ResourceEfficiencyCenter";
import { CostForecastingEngine } from "@/components/cost/CostForecastingEngine";
import { OptimizationRecommendations } from "@/components/cost/OptimizationRecommendations";
import { CostReliabilityAnalysis } from "@/components/cost/CostReliabilityAnalysis";
import { ExecutiveSummary } from "@/components/cost/ExecutiveSummary";

const TIME_RANGES = ["Last 7 Days", "Last 30 Days", "Last 90 Days", "This Month", "Last Month", "Custom"];
const PROVIDERS = [
    { id: "aws", label: "AWS", img: "/aws logo.png" },
    { id: "azure", label: "Azure", img: "/azure logo.png" },
    { id: "gcp", label: "Google Cloud", img: "/gcp logo.png" },
];

export default function CostPage() {
    const [timeRange, setTimeRange] = useState("Last 30 Days");
    const [timeOpen, setTimeOpen] = useState(false);
    const [activeProvider, setActiveProvider] = useState("aws");

    return (
        <div className="flex-1 overflow-y-auto wi-scrollbar bg-[rgba(255,255,255,0.02)]">
            <style jsx global>{`
                .wi-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
                .wi-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
                .wi-scrollbar::-webkit-scrollbar-thumb { background: rgba(15,23,42,0.14); border-radius: 3px; }
                @keyframes wi-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
            `}</style>

            <div className="px-4 pt-4 pb-6 space-y-3">
                {/* Cost page sub-header: Time Range + Cloud Providers */}
                <div className="flex items-center justify-end gap-3">
                    {/* Time Range */}
                    <div className="relative">
                        <button
                            onClick={() => setTimeOpen(o => !o)}
                            className="flex items-center gap-2 h-9 px-3 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] hover:border-[rgba(15,23,42,0.20)] transition-colors"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                            <div className="text-left">
                                <p className="text-[9px] text-[#64748b] leading-none">Time Range</p>
                                <p className="text-[12px] text-[#f7f8f8] font-semibold leading-tight">{timeRange}</p>
                            </div>
                            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className={`transition-transform ${timeOpen ? "rotate-180" : ""}`}>
                                <path d="M2 4L6 8L10 4" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                        {timeOpen && (
                            <div className="absolute top-full mt-1 right-0 z-30 w-44 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] shadow-[0_8px_24px_rgba(0,0,0,0.5)] py-1">
                                {TIME_RANGES.map(t => (
                                    <button
                                        key={t}
                                        onClick={() => { setTimeRange(t); setTimeOpen(false); }}
                                        className={`w-full text-left px-3 py-1.5 text-[11.5px] hover:bg-[rgba(15,23,42,0.10)] transition-colors ${timeRange === t ? "text-[#7170ff]" : "text-[#f7f8f8]"}`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Cloud Provider Icons */}
                    <div className="flex items-center gap-1.5">
                        {PROVIDERS.map(p => (
                            <button
                                key={p.id}
                                onClick={() => setActiveProvider(p.id)}
                                className={`w-10 h-10 rounded-lg bg-[rgba(255,255,255,0.02)] flex items-center justify-center transition-colors ${activeProvider === p.id
                                    ? "border-2 border-[#f0883e]/70 shadow-[0_0_8px_rgba(240,136,62,0.3)]"
                                    : "border border-[rgba(15,23,42,0.14)] hover:border-[rgba(15,23,42,0.20)]"
                                    }`}
                                title={p.label}
                            >
                                <img src={p.img} alt={p.label} width={22} height={22} className="object-contain" />
                            </button>
                        ))}
                    </div>
                </div>

                <CostStatsRow />

                {/* Row 2: Cost Breakdown + AI Cost Insights + Cost Anomaly Detection */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <CostBreakdown />
                    <AICostInsights />
                    <CostAnomalyDetection />
                </div>

                {/* Row 3: Heatmap + Resource Efficiency + Cost Forecasting */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <KubernetesCostHeatmap />
                    <ResourceEfficiencyCenter />
                    <CostForecastingEngine />
                </div>

                {/* Row 4: Optimization Recommendations + Cost vs Reliability + Executive Summary */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <OptimizationRecommendations />
                    <CostReliabilityAnalysis />
                    <ExecutiveSummary />
                </div>
            </div>
        </div>
    );
}
