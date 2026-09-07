"use client";

import { useEffect, useState } from "react";
import { getCostSummary, getRiskSummary, type CostSummary, type RiskSummaryResponse } from "@/lib/api";

const CHART_DATA: Record<string, { actual: string; forecast: string; annotation: string }> = {
    "7 Days": { actual: "0,85 30,82 60,78 90,75 120,72 150,70 180,68", forecast: "180,68 210,66 240,64 270,63 300,62", annotation: "Forecast: $5,800\nConfidence: 97%" },
    "30 Days": { actual: "0,80 30,75 60,70 90,65 120,60 150,55 180,50", forecast: "180,50 210,47 240,44 270,42 300,40", annotation: "Forecast: $22,300\nConfidence: 96%" },
    "90 Days": { actual: "0,90 30,85 60,78 90,72 120,65 150,58 180,52", forecast: "180,52 210,48 240,44 270,40 300,36", annotation: "Forecast: $68,400\nConfidence: 91%" },
};

export function CostForecastingEngine() {
    const [period, setPeriod] = useState("30 Days");
    const [costData, setCostData] = useState<CostSummary | null>(null);
    const [riskData, setRiskData] = useState<RiskSummaryResponse | null>(null);

    useEffect(() => {
        const load = () => {
            getCostSummary().then(setCostData).catch(() => null);
            getRiskSummary().then(setRiskData).catch(() => null);
        };
        load();
        const id = setInterval(load, 15000);
        return () => clearInterval(id);
    }, []);

    const data = CHART_DATA[period];
    const monthlySpend = costData?.monthly_spend ?? "—";
    const spendNum = costData ? parseFloat(costData.monthly_spend.replace(/[^0-9.]/g, "")) : 0;
    const savingsNum = costData ? parseFloat(costData.potential_savings.replace(/[^0-9.]/g, "")) : 0;
    const forecastNext = spendNum > 0 ? `$${Math.round(spendNum * 1.08).toLocaleString()}` : "—";
    const changePercent = spendNum > 0 ? `+${((savingsNum / spendNum) * 100).toFixed(1)}%` : "—";
    const budgetThreshold = spendNum > 0 ? `$${Math.round(spendNum * 1.15).toLocaleString()}` : "—";
    const aiConfidence = riskData ? `${riskData.ai_confidence}%` : "—";
    const aiConfidenceNum = riskData?.ai_confidence ?? 0;

    return (
        <div className="rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3.5">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-semibold text-[#f7f8f8]">Cost Forecasting Engine</h3>
                <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)]">
                    {["7 Days", "30 Days", "90 Days"].map(t => (
                        <button
                            key={t}
                            onClick={() => setPeriod(t)}
                            className={`px-2 h-5 rounded text-[9.5px] transition-colors ${period === t ? "bg-[#7170ff]/20 text-[#7170ff] font-medium" : "text-[#64748b] hover:text-[#f7f8f8]"}`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {/* Chart */}
            <div className="h-[120px] mb-3 relative">
                <svg width="100%" height="120" viewBox="0 0 300 100" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="fc-fill" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#7170ff" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#7170ff" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="fc-forecast" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#a371f7" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#a371f7" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <polygon points={`${data.actual} 180,100 0,100`} fill="url(#fc-fill)" />
                    <polyline points={data.actual} fill="none" stroke="#7170ff" strokeWidth="2" strokeLinecap="round" />
                    <polygon points={`${data.forecast} 300,100 180,100`} fill="url(#fc-forecast)" />
                    <polyline points={data.forecast} fill="none" stroke="#a371f7" strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round" />
                    <line x1="0" y1="35" x2="300" y2="35" stroke="#f85149" strokeWidth="0.8" strokeDasharray="3 3" strokeOpacity="0.5" />
                    <text x="240" y="30" fontSize="7" fill="#a371f7" fontFamily="var(--font-mono)">{data.annotation.split("\n")[0]}</text>
                    <text x="240" y="38" fontSize="6" fill="#64748b" fontFamily="var(--font-mono)">{data.annotation.split("\n")[1]}</text>
                </svg>
                <div className="absolute top-1 right-2 flex items-center gap-3 text-[9px]">
                    <span className="flex items-center gap-1 text-[#7170ff]"><span className="w-3 h-0.5 rounded-full bg-[#7170ff]" /> Actual Spend</span>
                    <span className="flex items-center gap-1 text-[#a371f7]"><span className="w-3 h-0.5 rounded-full bg-[#a371f7]" /> Forecast</span>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-2">
                {[
                    { label: "Current Trajectory", value: monthlySpend, change: changePercent, color: "#f0883e" },
                    { label: "Forecast Next Month", value: forecastNext, change: "+8.6%", color: "#f0883e" },
                    { label: "Budget Threshold", value: budgetThreshold, badge: "Within budget", badgeColor: "#3fb950" },
                    { label: "AI Confidence", value: aiConfidence, ring: true },
                ].map((s, i) => (
                    <div key={i} className="text-center">
                        <p className="text-[9px] text-[#64748b]">{s.label}</p>
                        <p className="text-[14px] font-bold text-[#f7f8f8] font-mono leading-none mt-1">{s.value}</p>
                        {s.change && <p className="text-[9px] mt-0.5" style={{ color: s.color }}>{s.change}</p>}
                        {s.badge && <p className="text-[9px] mt-0.5" style={{ color: s.badgeColor }}>{s.badge}</p>}
                        {s.ring && (
                            <svg width="28" height="28" viewBox="0 0 28 28" className="mx-auto mt-1">
                                <circle cx="14" cy="14" r="11" fill="none" stroke="rgba(15,23,42,0.10)" strokeWidth="3" />
                                <circle cx="14" cy="14" r="11" fill="none" stroke="#3fb950" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 11 * (aiConfidenceNum / 100)} ${2 * Math.PI * 11 * (1 - aiConfidenceNum / 100)}`} transform="rotate(-90 14 14)" style={{ filter: "drop-shadow(0 0 3px #3fb950)" }} />
                            </svg>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
