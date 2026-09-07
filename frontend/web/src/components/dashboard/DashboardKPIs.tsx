"use client";

import { Activity, AlertTriangle, Box, Wrench } from "lucide-react";

// ─── Dashboard KPI Cards — Glass SaaS style (matches Figma template) ─────────

export function DashboardKPIs({
    healthScore,
    activeIncidents,
    criticalCount,
    warningCount,
    services,
    remediations,
}: {
    healthScore: number;
    activeIncidents: number;
    criticalCount: number;
    warningCount: number;
    services: number;
    remediations: number;
}) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <GlassKPI
                icon={<Activity className="w-[15px] h-[15px]" strokeWidth={2.2} />}
                label="Cluster Health"
                value={`${healthScore}`}
                suffix="/100"
                pill={healthScore >= 80 ? "Excellent" : healthScore >= 50 ? "Fair" : "Degraded"}
                pillTone={healthScore >= 80 ? "success" : healthScore >= 50 ? "warning" : "danger"}
                tip="Health trending stable across all nodes"
                accent="#34c759"
            />
            <GlassKPI
                icon={<AlertTriangle className="w-[15px] h-[15px]" strokeWidth={2.2} />}
                label="AI Incident Analysis"
                value={`${activeIncidents}`}
                suffix="active"
                pill={activeIncidents > 0 ? "94% confidence" : "All clear"}
                pillTone={criticalCount > 0 ? "danger" : warningCount > 0 ? "warning" : "success"}
                tip={criticalCount > 0 ? `${criticalCount} critical · ${warningCount} warning` : "No active incidents detected"}
                accent="#7170ff"
            />
            <GlassKPI
                icon={<Box className="w-[15px] h-[15px]" strokeWidth={2.2} />}
                label="Active Services"
                value={`${services}`}
                suffix="running"
                pill={services > 0 ? "Healthy" : "—"}
                pillTone="success"
                tip="All services responding within SLO"
                accent="#22d3ee"
            />
            <GlassKPI
                icon={<Wrench className="w-[15px] h-[15px]" strokeWidth={2.2} />}
                label="Autonomous Remediation"
                value={`${remediations}`}
                suffix="actions"
                pill={remediations > 0 ? "Active" : "Idle"}
                pillTone={remediations > 0 ? "success" : "neutral"}
                tip="Night Guardian standing by for auto-fixes"
                accent="#828fff"
            />
        </div>
    );
}

// ─── Glass KPI card — nested translucent glass with AI tip row ───────────────

type PillTone = "success" | "warning" | "danger" | "neutral";

const toneColors: Record<PillTone, { bg: string; text: string }> = {
    success: { bg: "rgba(16,185,129,0.14)", text: "#34d399" },
    warning: { bg: "rgba(245,166,35,0.14)", text: "#f5a623" },
    danger: { bg: "rgba(235,87,87,0.14)", text: "#f87171" },
    neutral: { bg: "rgba(255,255,255,0.05)", text: "#8a8f98" },
};

function GlassKPI({
    icon,
    label,
    value,
    suffix,
    pill,
    pillTone,
    tip,
    accent,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    suffix?: string;
    pill: string;
    pillTone: PillTone;
    tip: string;
    accent: string;
}) {
    const tone = toneColors[pillTone];
    return (
        <div
            className="group relative rounded-[12px] overflow-hidden transition-colors duration-200"
            style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.08)",
            }}
        >
            {/* Content */}
            <div className="px-4 pt-4 pb-3">
                {/* Label row */}
                <div className="flex items-center gap-2.5 mb-3.5">
                    <span
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{
                            color: accent,
                            background: `${accent}1a`,
                            boxShadow: `inset 0 0 0 1px ${accent}33`,
                        }}
                    >{icon}</span>
                    <p className="text-[13px] text-[#8a8f98] font-medium" style={{ letterSpacing: "-0.13px" }}>{label}</p>
                </div>

                {/* Value + pill */}
                <div className="flex items-center gap-2.5">
                    <span className="text-[28px] font-medium text-[#f7f8f8] leading-none" style={{ letterSpacing: "-0.7px", fontWeight: 510 }}>{value}</span>
                    {suffix && <span className="text-[12px] text-[#62666d] font-medium">{suffix}</span>}
                    <span
                        className="ml-auto inline-flex items-center h-[20px] px-2 rounded-full text-[10px] font-semibold whitespace-nowrap"
                        style={{ background: tone.bg, color: tone.text }}
                    >
                        {pill}
                    </span>
                </div>
            </div>

            {/* AI tip row — subtle top border + violet marker */}
            <div className="relative flex items-center gap-2 px-4 py-2.5 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <div className="self-stretch w-[2px] rounded-full shrink-0" style={{ background: "#7170ff" }} />
                <p className="flex-1 text-[11.5px] text-[#8a8f98] leading-snug truncate">{tip}</p>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7170ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
            </div>
        </div>
    );
}
