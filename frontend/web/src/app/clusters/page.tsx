"use client";

import { ClusterStatsRow } from "@/components/clusters/ClusterStatsRow";
import { ClusterFleetMap } from "@/components/clusters/ClusterFleetMap";
import { AIFleetIntelligence } from "@/components/clusters/AIFleetIntelligence";
import { AutonomousOperations } from "@/components/clusters/AutonomousOperations";
import { ClusterHealthDistribution } from "@/components/clusters/ClusterHealthDistribution";
import { FleetResourceOverview } from "@/components/clusters/FleetResourceOverview";

export default function ClustersPage() {
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
                <ClusterStatsRow />

                {/* Fleet Map + AI Fleet Intelligence + Active Incident Timeline */}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-3">
                    <ClusterFleetMap />
                    <div className="space-y-3">
                        <AIFleetIntelligence />
                    </div>
                </div>

                {/* Bottom row: Autonomous Operations + Health Distribution + Fleet Resource */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <AutonomousOperations />
                    <ClusterHealthDistribution />
                    <FleetResourceOverview />
                </div>
            </div>
        </div>
    );
}
