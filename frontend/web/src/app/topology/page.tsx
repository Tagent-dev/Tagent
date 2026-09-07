"use client";

import { useEffect, useState } from "react";
import { getClusterState, type ClusterState } from "@/lib/api";
import { Loader2, WifiOff } from "lucide-react";

// Colors for different service types
const SERVICE_COLORS: Record<string, string> = {
    "ClusterIP": "#3fb950",
    "NodePort": "#7170ff",
    "LoadBalancer": "#a371f7",
    "ExternalName": "#22d3ee",
};

const STATUS_COLORS: Record<string, string> = {
    "Running": "#3fb950",
    "CrashLoopBackOff": "#f85149",
    "Error": "#f85149",
    "Pending": "#f0883e",
    "OOMKilled": "#f85149",
    "Ready": "#3fb950",
    "NotReady": "#f85149",
};

export default function TopologyPage() {
    const [data, setData] = useState<ClusterState | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const state = await getClusterState();
                setData(state);
                setError(null);
            } catch (e: any) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        }
        load();
        const interval = setInterval(load, 15000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-[rgba(255,255,255,0.02)]">
                <Loader2 className="w-5 h-5 text-zinc-500 animate-spin mr-2" />
                <span className="text-sm text-zinc-500">Loading topology...</span>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex-1 flex items-center justify-center bg-[rgba(255,255,255,0.02)]">
                <WifiOff className="w-5 h-5 text-amber-400 mr-2" />
                <span className="text-sm text-zinc-400">{error || "No cluster data"}</span>
            </div>
        );
    }

    // Build topology data from real cluster state
    const nodes = data.nodes || [];
    const pods = data.pods || [];
    const services = data.services || [];
    const deployments = data.deployments || [];
    const namespaces = data.namespaces || [];

    // Group pods by deployment/service name (strip random suffix)
    const serviceGroups: Record<string, { name: string; namespace: string; podCount: number; status: string; type: string }> = {};

    for (const dep of deployments) {
        serviceGroups[`${dep.namespace}/${dep.name}`] = {
            name: dep.name,
            namespace: dep.namespace,
            podCount: dep.replicas,
            status: dep.ready === dep.replicas ? "healthy" : dep.ready > 0 ? "degraded" : "critical",
            type: "deployment",
        };
    }

    for (const svc of services) {
        const key = `${svc.namespace}/${svc.name}`;
        if (!serviceGroups[key]) {
            serviceGroups[key] = {
                name: svc.name,
                namespace: svc.namespace,
                podCount: 0,
                status: "healthy",
                type: svc.type,
            };
        }
    }

    const groupList = Object.values(serviceGroups);

    return (
        <div className="flex-1 overflow-hidden bg-[rgba(255,255,255,0.02)] flex flex-col">
            {/* Header */}
            <div className="px-5 py-3 border-b border-[rgba(15,23,42,0.10)] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <h1 className="text-[15px] font-semibold text-[#f7f8f8]">Kubernetes Topology</h1>
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#3fb950]/10 border border-[#3fb950]/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] animate-pulse" />
                        <span className="text-[10px] text-[#3fb950] font-semibold">Live</span>
                    </span>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-[#64748b]">
                    <span>{nodes.length} Nodes</span>
                    <span>{pods.length} Pods</span>
                    <span>{services.length} Services</span>
                    <span>{deployments.length} Deployments</span>
                </div>
            </div>

            {/* Topology Visualization */}
            <div className="flex-1 overflow-auto p-5">
                {/* Visual graph area */}
                <div className="relative w-full min-h-[600px] rounded-xl border border-[rgba(15,23,42,0.10)]" style={{
                    background: "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(30,60,120,0.12) 0%, transparent 70%), linear-gradient(180deg, #0f1011 0%, #191a1b 50%, #0f1011 100%)"
                }}>
                    {/* Node layer (top) */}
                    <div className="absolute top-6 left-0 right-0 flex justify-center gap-4 px-8">
                        {nodes.map((node, i) => {
                            const nodePods = pods.filter(p => p.node === node.name);
                            const failing = nodePods.filter(p => p.status !== "Running" && p.status !== "Succeeded" && p.status !== "Completed").length;
                            return (
                                <div key={node.name} className="flex flex-col items-center group">
                                    <div className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center transition-all group-hover:scale-110 ${node.status === "Ready" ? "border-[#3fb950] bg-[#3fb950]/10" : "border-[#f85149] bg-[#f85149]/10"}`}
                                        style={{ boxShadow: `0 0 12px ${node.status === "Ready" ? "#3fb95040" : "#f8514940"}` }}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={node.status === "Ready" ? "#3fb950" : "#f85149"} strokeWidth="1.5">
                                            <rect x="2" y="3" width="20" height="14" rx="2" />
                                            <line x1="8" y1="21" x2="16" y2="21" />
                                            <line x1="12" y1="17" x2="12" y2="21" />
                                        </svg>
                                    </div>
                                    <span className="text-[10px] text-[#f7f8f8] font-mono mt-1.5 max-w-[100px] truncate">{node.name.replace("ip-", "")}</span>
                                    <span className="text-[9px] text-[#64748b]">{nodePods.length} pods{failing > 0 ? ` · ${failing} failing` : ""}</span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Service/Deployment layer (middle) */}
                    <div className="absolute top-[140px] left-0 right-0 px-8">
                        <div className="flex flex-wrap justify-center gap-3">
                            {groupList.slice(0, 24).map((svc, i) => {
                                const color = svc.status === "healthy" ? "#3fb950" : svc.status === "degraded" ? "#f0883e" : "#f85149";
                                return (
                                    <div key={`${svc.namespace}/${svc.name}`} className="flex flex-col items-center group">
                                        <div className="w-12 h-12 rounded-lg border flex items-center justify-center transition-all group-hover:scale-110"
                                            style={{ borderColor: color, background: `${color}15`, boxShadow: `0 0 8px ${color}30` }}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
                                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                                            </svg>
                                        </div>
                                        <span className="text-[9px] text-[#f7f8f8] font-mono mt-1 max-w-[80px] truncate">{svc.name}</span>
                                        <span className="text-[8px] text-[#64748b]">{svc.podCount} pods</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Namespace layer (bottom) */}
                    <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-3 px-8">
                        {namespaces.slice(0, 8).map(ns => {
                            const nsPods = pods.filter(p => p.namespace === ns);
                            return (
                                <div key={ns} className="px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] text-center">
                                    <span className="text-[10px] text-[#7170ff] font-mono">{ns}</span>
                                    <span className="text-[8px] text-[#64748b] block">{nsPods.length} pods</span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Connection lines (SVG) */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
                        <defs>
                            <linearGradient id="line-green" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#3fb950" stopOpacity="0.6" />
                                <stop offset="100%" stopColor="#3fb950" stopOpacity="0.1" />
                            </linearGradient>
                            <linearGradient id="line-blue" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#7170ff" stopOpacity="0.5" />
                                <stop offset="100%" stopColor="#7170ff" stopOpacity="0.1" />
                            </linearGradient>
                        </defs>
                        {/* Animated orbital paths */}
                        <ellipse cx="50%" cy="45%" rx="35%" ry="25%" fill="none" stroke="#22d3ee" strokeWidth="0.5" strokeOpacity="0.2" strokeDasharray="4 6" />
                        <ellipse cx="50%" cy="45%" rx="25%" ry="18%" fill="none" stroke="#3fb950" strokeWidth="0.5" strokeOpacity="0.15" strokeDasharray="3 5" />
                        {/* Animated dot on path */}
                        <circle r="2.5" fill="#22d3ee" opacity="0.8">
                            <animateMotion dur="8s" repeatCount="indefinite" path="M 400,270 m -200,0 a 200,150 0 1,0 400,0 a 200,150 0 1,0 -400,0" />
                        </circle>
                        <circle r="2" fill="#3fb950" opacity="0.7">
                            <animateMotion dur="6s" repeatCount="indefinite" path="M 400,270 m -150,0 a 150,108 0 1,1 300,0 a 150,108 0 1,1 -300,0" />
                        </circle>
                    </svg>

                    {/* Legend */}
                    <div className="absolute bottom-6 left-6 space-y-1.5">
                        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#3fb950]" /><span className="text-[9px] text-[#64748b]">Healthy</span></div>
                        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#f0883e]" /><span className="text-[9px] text-[#64748b]">Degraded</span></div>
                        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#f85149]" /><span className="text-[9px] text-[#64748b]">Critical</span></div>
                    </div>

                    {/* Stats overlay */}
                    <div className="absolute bottom-6 right-6 flex items-center gap-4 text-[10px] font-mono">
                        <span className="text-[#64748b]">Pods <span className="text-[#3fb950] font-semibold">{pods.filter(p => p.status === "Running").length}</span>/{pods.length}</span>
                        <span className="text-[#64748b]">Services <span className="text-[#7170ff] font-semibold">{services.length}</span></span>
                        <span className="text-[#64748b]">Failing <span className="text-[#f85149] font-semibold">{pods.filter(p => p.status !== "Running" && p.status !== "Succeeded" && p.status !== "Completed").length}</span></span>
                    </div>
                </div>
            </div>
        </div>
    );
}
