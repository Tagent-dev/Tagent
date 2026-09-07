"use client";

import { useState } from "react";
import { StatsRow } from "./StatsRow";
import { WorkloadTopologyPanel } from "./WorkloadTopologyPanel";
import { WorkloadExplorer } from "./WorkloadExplorer";
import { AIInsightsSidebar } from "./AIInsightsSidebar";

export function WorkloadIntelligence() {
    return (
        <div className="flex-1 overflow-y-auto wi-scrollbar bg-[rgba(255,255,255,0.02)]">
            <style jsx global>{`
                .wi-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
                .wi-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
                .wi-scrollbar::-webkit-scrollbar-thumb { background: rgba(15,23,42,0.14); border-radius: 3px; }
                .wi-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(15,23,42,0.20); }

                @keyframes wi-dash {
                    to { stroke-dashoffset: -24; }
                }
                .wi-flow-high { stroke-dasharray: 8 4; animation: wi-dash 0.8s linear infinite; }
                .wi-flow-medium { stroke-dasharray: 6 4; animation: wi-dash 1.2s linear infinite; }
                .wi-flow-low { stroke-dasharray: 4 4; animation: wi-dash 1.8s linear infinite; }

                @keyframes wi-pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }
                .wi-live-dot { animation: wi-pulse 2s ease-in-out infinite; }

                @keyframes wi-ring-fill {
                    from { stroke-dashoffset: 283; }
                    to { stroke-dashoffset: 23; }
                }
                .wi-ring-fill { animation: wi-ring-fill 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards; }

                @keyframes wi-sparkle {
                    0%, 100% { opacity: 0.3; transform: scale(0.8); }
                    50% { opacity: 1; transform: scale(1.2); }
                }
                .wi-sparkle { animation: wi-sparkle 2s ease-in-out infinite; }
            `}</style>

            <div className="px-4 pt-4 pb-6">
                {/* Stats Row (header lives in global TopBar) */}
                <StatsRow />

                {/* Main Grid: Topology + Explorer (left) | AI Insights (right) */}
                <div className="mt-4 grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-3">
                    <div className="space-y-3 min-w-0">
                        <WorkloadTopologyPanel />
                        <WorkloadExplorer />
                    </div>
                    <AIInsightsSidebar />
                </div>
            </div>
        </div>
    );
}
