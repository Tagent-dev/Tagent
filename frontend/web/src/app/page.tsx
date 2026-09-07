"use client";

import { useEffect, useState } from "react";
import {
    getClusterState,
    getIncidents,
    getMetricsSummary,
    getRemediationHistory,
    type ClusterState,
    type Incident,
    type MetricsSummary,
    type RemediationResult,
} from "@/lib/api";
import { useTagentWS } from "@/lib/useWebSocket";
import { DashboardKPIs } from "@/components/dashboard/DashboardKPIs";
import { KubernetesTopology } from "@/components/dashboard/KubernetesTopology";
import { IncidentAnalysisPanel } from "@/components/dashboard/IncidentAnalysisPanel";
import { OperationsFeed } from "@/components/dashboard/OperationsFeed";

export default function Dashboard() {
    const [data, setData] = useState<ClusterState | null>(null);
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
    const [remediations, setRemediations] = useState<RemediationResult[]>([]);
    useTagentWS("incident");

    useEffect(() => {
        let interval: NodeJS.Timeout;
        async function fetchData() {
            try {
                const [state, incidentData, metricData, remHistory] = await Promise.all([
                    getClusterState().catch(() => null),
                    getIncidents().catch(() => ({ incidents: [], total: 0 })),
                    getMetricsSummary().catch(() => null),
                    getRemediationHistory().catch(() => ({ history: [], total: 0 })),
                ]);
                if (state) setData(state);
                setIncidents(incidentData.incidents || []);
                if (metricData) setMetrics(metricData);
                setRemediations(remHistory.history || []);
            } catch { }
        }
        fetchData();
        interval = setInterval(fetchData, 15000);
        return () => clearInterval(interval);
    }, []);

    const summary = data?.summary;
    const activeIncidents = incidents.filter(i => i.status !== "resolved");
    const criticalCount = activeIncidents.filter(i => i.severity === "critical").length;
    const warningCount = activeIncidents.filter(i => i.severity === "medium" || i.severity === "high").length;

    const healthScore = summary
        ? Math.round(((summary.running_pods / (summary.total_pods || 1)) * 50) + ((summary.ready_nodes / (summary.total_nodes || 1)) * 50))
        : 0;

    return (
        <div className="flex-1 overflow-y-auto scrollbar">
            <div className="px-4 pt-4 pb-6 space-y-3">
                {/* KPI Row — always visible */}
                <DashboardKPIs
                    healthScore={healthScore}
                    activeIncidents={activeIncidents.length}
                    criticalCount={criticalCount}
                    warningCount={warningCount}
                    services={summary?.total_services || 0}
                    remediations={remediations.length}
                />

                {/* Topology + Incident Analysis */}
                <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-3">
                    <KubernetesTopology />
                    <IncidentAnalysisPanel />
                </div>

                {/* Operations Feed */}
                <OperationsFeed />
            </div>
        </div>
    );
}
