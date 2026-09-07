"use client";

import { useEffect, useState } from "react";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { getPredictivePredictions } from "@/lib/api";

// ─── Predictive Demand Forecasting (Recharts area chart) ─────────────────────

const PERIODS = ["1H", "24H", "7D", "30D"];

const FALLBACK_DATA_24H = [
    { time: "00:00", actual: 35, forecast: null, upper: null, lower: null },
    { time: "02:00", actual: 38, forecast: null, upper: null, lower: null },
    { time: "04:00", actual: 42, forecast: null, upper: null, lower: null },
    { time: "06:00", actual: 50, forecast: null, upper: null, lower: null },
    { time: "08:00", actual: 58, forecast: null, upper: null, lower: null },
    { time: "10:00", actual: 68, forecast: null, upper: null, lower: null },
    { time: "12:00", actual: 78, forecast: 78, upper: 78, lower: 78 },
    { time: "14:00", actual: null, forecast: 86, upper: 98, lower: 74 },
    { time: "16:00", actual: null, forecast: 92, upper: 108, lower: 76 },
    { time: "18:00", actual: null, forecast: 98, upper: 114, lower: 80 },
    { time: "20:00", actual: null, forecast: 104, upper: 120, lower: 84 },
    { time: "22:00", actual: null, forecast: 108, upper: 124, lower: 86 },
    { time: "24:00", actual: null, forecast: 112, upper: 128, lower: 88 },
];

const FALLBACK_DATA_1H = [
    { time: "11:00", actual: 72, forecast: null, upper: null, lower: null },
    { time: "11:10", actual: 74, forecast: null, upper: null, lower: null },
    { time: "11:20", actual: 75, forecast: null, upper: null, lower: null },
    { time: "11:30", actual: 76, forecast: null, upper: null, lower: null },
    { time: "11:40", actual: 77, forecast: null, upper: null, lower: null },
    { time: "11:50", actual: 78, forecast: 78, upper: 78, lower: 78 },
    { time: "12:00", actual: null, forecast: 80, upper: 84, lower: 76 },
    { time: "12:10", actual: null, forecast: 81, upper: 86, lower: 77 },
    { time: "12:20", actual: null, forecast: 82, upper: 87, lower: 78 },
    { time: "12:30", actual: null, forecast: 83, upper: 88, lower: 79 },
    { time: "12:40", actual: null, forecast: 84, upper: 89, lower: 80 },
    { time: "12:50", actual: null, forecast: 85, upper: 90, lower: 80 },
];

const FALLBACK_DATA_7D = [
    { time: "Mon", actual: 45, forecast: null, upper: null, lower: null },
    { time: "Tue", actual: 58, forecast: null, upper: null, lower: null },
    { time: "Wed", actual: 72, forecast: null, upper: null, lower: null },
    { time: "Thu", actual: 78, forecast: 78, upper: 78, lower: 78 },
    { time: "Fri", actual: null, forecast: 92, upper: 112, lower: 72 },
    { time: "Sat", actual: null, forecast: 105, upper: 130, lower: 80 },
    { time: "Sun", actual: null, forecast: 118, upper: 148, lower: 88 },
];

const FALLBACK_DATA_30D = [
    { time: "W1", actual: 40, forecast: null, upper: null, lower: null },
    { time: "W2", actual: 55, forecast: null, upper: null, lower: null },
    { time: "W3", actual: 72, forecast: 72, upper: 72, lower: 72 },
    { time: "W4", actual: null, forecast: 95, upper: 120, lower: 70 },
    { time: "W5", actual: null, forecast: 115, upper: 150, lower: 80 },
];

const FALLBACK_DATA_MAP: Record<string, typeof FALLBACK_DATA_24H> = {
    "1H": FALLBACK_DATA_1H,
    "24H": FALLBACK_DATA_24H,
    "7D": FALLBACK_DATA_7D,
    "30D": FALLBACK_DATA_30D,
};

const FALLBACK_STATS_MAP: Record<string, { peak: string; peakTime: string; events: string; growth: string; confidence: string }> = {
    "1H": { peak: "85", peakTime: "12:50", events: "2", growth: "+4%", confidence: "98%" },
    "24H": { peak: "112", peakTime: "3:00 PM", events: "9", growth: "+18%", confidence: "94%" },
    "7D": { peak: "148", peakTime: "Sun", events: "34", growth: "+24%", confidence: "89%" },
    "30D": { peak: "186", peakTime: "Week 5", events: "112", growth: "+31%", confidence: "85%" },
};

function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-md bg-[rgba(255,255,255,0.02)]/95 border border-[rgba(15,23,42,0.14)] px-3 py-2 backdrop-blur-sm shadow-lg">
            <p className="text-[11px] text-[#f7f8f8] font-semibold mb-1">{label}</p>
            {payload.map((p: any, i: number) => (
                p.value != null && (
                    <div key={i} className="flex items-center justify-between gap-4 text-[10px]">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-0.5 rounded-full" style={{ background: p.color }} />
                            <span className="text-[#64748b]">{p.name}</span>
                        </span>
                        <span className="text-[#f7f8f8] font-mono font-bold">{p.value}</span>
                    </div>
                )
            ))}
        </div>
    );
}

export function PredictiveDemandForecasting() {
    const [period, setPeriod] = useState("24H");
    const [dataMap, setDataMap] = useState<Record<string, Array<{ time: string; actual: number | null; forecast: number | null; upper: number | null; lower: number | null }>>>({});
    const [statsMap, setStatsMap] = useState<Record<string, { peak: string; peakTime: string; events: string; growth: string; confidence: string }>>({});

    useEffect(() => {
        let active = true;
        const fetchData = () => {
            getPredictivePredictions()
                .then((data) => {
                    if (!active || data.predictions.length === 0) return;
                    // Derive stats from predictions
                    const maxConf = Math.max(...data.predictions.map(p => p.confidence));
                    const topPrediction = data.predictions[0];
                    const newStats: Record<string, { peak: string; peakTime: string; events: string; growth: string; confidence: string }> = {
                        "24H": {
                            peak: String(data.total || data.predictions.length),
                            peakTime: topPrediction?.time_to_failure ?? "N/A",
                            events: String(data.predictions.length),
                            growth: `+${Math.round((topPrediction?.probability ?? 0) * 100)}%`,
                            confidence: `${Math.round(maxConf * 100)}%`,
                        },
                    };
                    setStatsMap(newStats);
                })
                .catch(() => { });
        };
        fetchData();
        const interval = setInterval(fetchData, 15_000);
        return () => { active = false; clearInterval(interval); };
    }, []);

    const chartData = dataMap[period] || [];
    const stats = statsMap[period] || { peak: "—", peakTime: "—", events: "—", growth: "—", confidence: "—" };

    return (
        <div className="rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3.5">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-[14px] font-semibold text-[#f7f8f8]">Predictive Demand Forecasting</h3>
                <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)]">
                    {PERIODS.map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-2.5 h-6 rounded text-[10px] font-medium transition-colors ${period === p ? "bg-[#7170ff]/20 text-[#7170ff]" : "text-[#64748b] hover:text-[#f7f8f8]"}`}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            {/* Chart */}
            <div className="h-[220px] -mx-2">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <defs>
                            <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#7170ff" stopOpacity={0.3} />
                                <stop offset="100%" stopColor="#7170ff" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#3fb950" stopOpacity={0.2} />
                                <stop offset="100%" stopColor="#3fb950" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#a371f7" stopOpacity={0.15} />
                                <stop offset="100%" stopColor="#a371f7" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.10)" strokeOpacity={0.6} />
                        <XAxis dataKey="time" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={{ stroke: "rgba(15,23,42,0.10)" }} tickLine={false} />
                        <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={{ stroke: "rgba(15,23,42,0.10)" }} tickLine={false} domain={[0, "auto"]} label={{ value: "Replicas", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 10 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                            verticalAlign="top"
                            height={28}
                            iconType="line"
                            wrapperStyle={{ fontSize: "10px", color: "#64748b" }}
                        />
                        {/* Upper bound area */}
                        <Area type="monotone" dataKey="upper" name="Upper Bound" stroke="#a371f7" strokeWidth={1.5} strokeDasharray="4 3" fill="url(#bandGrad)" connectNulls={false} dot={false} />
                        {/* Lower bound */}
                        <Area type="monotone" dataKey="lower" name="Lower Bound" stroke="#ec4899" strokeWidth={1.5} strokeDasharray="4 3" fill="none" connectNulls={false} dot={false} />
                        {/* Forecast */}
                        <Area type="monotone" dataKey="forecast" name="Forecast" stroke="#3fb950" strokeWidth={2.5} strokeDasharray="6 4" fill="url(#forecastGrad)" connectNulls={false} dot={false} activeDot={{ r: 5, fill: "#3fb950", stroke: "rgba(255,255,255,0.02)", strokeWidth: 2 }} />
                        {/* Actual */}
                        <Area type="monotone" dataKey="actual" name="Actual" stroke="#7170ff" strokeWidth={2.5} fill="url(#actualGrad)" connectNulls={false} dot={false} activeDot={{ r: 5, fill: "#7170ff", stroke: "rgba(255,255,255,0.02)", strokeWidth: 2 }} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Bottom stats */}
            <div className="grid grid-cols-4 gap-3 pt-3 border-t border-[rgba(15,23,42,0.10)]">
                <div>
                    <p className="text-[9.5px] text-[#64748b]">Peak Replicas (Predicted)</p>
                    <p className="text-[22px] font-bold text-[#f7f8f8] font-mono leading-none mt-1">{stats.peak}</p>
                    <p className="text-[9px] text-[#94a3b8] mt-0.5">{stats.peakTime}</p>
                </div>
                <div>
                    <p className="text-[9.5px] text-[#64748b]">Scale Events (Predicted)</p>
                    <p className="text-[22px] font-bold text-[#f7f8f8] font-mono leading-none mt-1">{stats.events}</p>
                    <p className="text-[9px] text-[#94a3b8] mt-0.5">Next period</p>
                </div>
                <div>
                    <p className="text-[9.5px] text-[#64748b]">Growth Trend</p>
                    <p className="text-[22px] font-bold text-[#3fb950] font-mono leading-none mt-1">{stats.growth}</p>
                    <p className="text-[9px] text-[#94a3b8] mt-0.5">vs previous</p>
                </div>
                <div>
                    <p className="text-[9.5px] text-[#64748b]">Confidence</p>
                    <p className="text-[22px] font-bold text-[#3fb950] font-mono leading-none mt-1">{stats.confidence}</p>
                    <p className="text-[9px] text-[#f0883e] font-semibold mt-0.5">High</p>
                </div>
            </div>
        </div>
    );
}
