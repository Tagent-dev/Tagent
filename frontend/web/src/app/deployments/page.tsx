"use client";

import { DeploymentStatsRow } from "@/components/deployments/DeploymentStatsRow";
import { DeploymentHealthMatrix } from "@/components/deployments/DeploymentHealthMatrix";
import { AIDeploymentInsights } from "@/components/deployments/AIDeploymentInsights";
import { DependencyImpactMap } from "@/components/deployments/DependencyImpactMap";
import { RolloutTimeline } from "@/components/deployments/RolloutTimeline";
import { VersionIntelligence } from "@/components/deployments/VersionIntelligence";
import { LiveActivityFeed } from "@/components/deployments/LiveActivityFeed";

export default function DeploymentsPage() {
    return (
        <div className="flex-1 overflow-y-auto wi-scrollbar bg-[rgba(255,255,255,0.02)]">
            <style jsx global>{`
                .wi-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
                .wi-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
                .wi-scrollbar::-webkit-scrollbar-thumb { background: rgba(15,23,42,0.14); border-radius: 3px; }
                @keyframes wi-dash { to { stroke-dashoffset: -24; } }
                .wi-flow-medium { stroke-dasharray: 6 4; animation: wi-dash 1.2s linear infinite; }
                @keyframes wi-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
            `}</style>

            <div className="px-4 pt-4 pb-6 space-y-3">
                {/* 6 Stat Cards */}
                <DeploymentStatsRow />

                {/* Middle row: Health Matrix + AI Insights + Dependency Map */}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px_320px] gap-3">
                    <DeploymentHealthMatrix />
                    <AIDeploymentInsights />
                    <DependencyImpactMap />
                </div>

                {/* Bottom row: Rollout Timeline + Version Intelligence + Live Activity Feed */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <RolloutTimeline />
                    <VersionIntelligence />
                    <LiveActivityFeed />
                </div>
            </div>
        </div>
    );
}
