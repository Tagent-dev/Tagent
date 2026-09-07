"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
    getNodeDetail, getNodeCloudInfo, getNodeMetrics,
    type NodeDetail, type NodeCloudResponse, type NodeMetricsHistory, type MetricsDataPoint,
} from "@/lib/api";
import {
    ArrowLeft, Server, Box, Activity, CheckCircle, XCircle,
    Loader2, AlertTriangle, Cloud, Layers, BarChart3,
    HardDrive, Tag, Shield, Network,
} from "lucide-react";
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
} from "recharts";

type Tab = "details" | "metrics" | "pods" | "cloud" | "networking" | "storage" | "tags" | "events";

export default function NodeDetailPage() {
    const params = useParams();
    const nodeName = decodeURIComponent(params.name as string);

    const [node, setNode] = useState<NodeDetail | null>(null);
    const [cloudInfo, setCloudInfo] = useState<NodeCloudResponse | null>(null);
    const [metricsData, setMetricsData] = useState<NodeMetricsHistory | null>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<Tab>("details");
    const [metricsRange, setMetricsRange] = useState("1h");

    useEffect(() => {
        async function load() {
            try {
                const [nodeData, cloud] = await Promise.all([
                    getNodeDetail(nodeName),
                    getNodeCloudInfo(nodeName).catch(() => null),
                ]);
                setNode(nodeData);
                setCloudInfo(cloud);
            } catch { }
            setLoading(false);
        }
        load();
    }, [nodeName]);

    // Load metrics when metrics tab is selected or range changes
    useEffect(() => {
        if (tab === "metrics") {
            getNodeMetrics(nodeName, metricsRange)
                .then(setMetricsData)
                .catch(() => setMetricsData(null));
        }
    }, [tab, metricsRange, nodeName]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                <span className="ml-3 text-slate-400">Loading node details...</span>
            </div>
        );
    }

    if (!node) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <AlertTriangle className="w-12 h-12 text-amber-400" />
                <p className="text-slate-300">Node &quot;{nodeName}&quot; not found</p>
                <Link href="/nodes" className="text-sm text-blue-400 hover:text-blue-300">&larr; Back to Nodes</Link>
            </div>
        );
    }

    const isReady = node.status === "Ready";
    const cpuColor = node.cpu_percent > 80 ? "#f85149" : node.cpu_percent > 60 ? "#f0883e" : "#22d3ee";
    const memColor = node.memory_percent > 80 ? "#f85149" : node.memory_percent > 60 ? "#f0883e" : "#a371f7";
    const provider = node.provider_id?.includes("aws") ? "AWS EKS" : node.provider_id?.includes("gce") ? "GCP GKE" : "Kubernetes";

    return (
        <div className="flex-1 overflow-y-auto bg-[rgba(255,255,255,0.02)]">
            <div className="max-w-7xl mx-auto px-6 py-5 space-y-5">
                {/* Back + Header */}
                <div>
                    <Link href="/nodes" className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 mb-3">
                        <ArrowLeft className="w-3.5 h-3.5" /> Back to Nodes
                    </Link>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center">
                                <Server className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-slate-100 font-mono">{node.name}</h1>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {node.role} &middot; {node.instance_type || provider} &middot; {node.availability_zone || node.region || "—"} &middot; Uptime: {node.age}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${isReady ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                                {isReady ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                {node.status}
                            </span>
                        </div>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <KPICard label="CPU Usage" value={`${node.cpu_percent}%`} sub={`${node.cpu_used || "—"} / ${node.cpu_capacity}`} color={cpuColor} percent={node.cpu_percent} />
                    <KPICard label="Memory Usage" value={`${node.memory_percent}%`} sub={`${node.memory_used || "—"} / ${node.memory_capacity}`} color={memColor} percent={node.memory_percent} />
                    <KPICard label="Pods" value={String(node.pod_count)} sub={`capacity: ${node.pod_capacity}`} color="#3fb950" percent={(node.pod_count / (parseInt(node.pod_capacity) || 110)) * 100} />
                    <KPICard label="Health Score" value={isReady ? "100" : "0"} sub={isReady ? "All checks passed" : "Node NotReady"} color={isReady ? "#3fb950" : "#f85149"} percent={isReady ? 100 : 0} />
                </div>

                {/* Tabs */}
                <div className="flex gap-1 border-b border-[rgba(15,23,42,0.10)] overflow-x-auto">
                    {([
                        { key: "details", label: "Details", icon: Layers },
                        { key: "metrics", label: "Metrics", icon: BarChart3 },
                        { key: "pods", label: `Pods (${node.pod_count})`, icon: Box },
                        { key: "cloud", label: "Cloud / Instance", icon: Cloud },
                        { key: "networking", label: "Networking", icon: Network },
                        { key: "storage", label: "Storage", icon: HardDrive },
                        { key: "tags", label: "Tags", icon: Tag },
                        { key: "events", label: "Events", icon: Activity },
                    ] as { key: Tab; label: string; icon: any }[]).map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.key ? "border-blue-500 text-blue-300" : "border-transparent text-slate-500 hover:text-slate-300"}`}
                        >
                            <t.icon className="w-3.5 h-3.5" /> {t.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                {tab === "details" && <DetailsTab node={node} />}
                {tab === "metrics" && <MetricsTab data={metricsData} range={metricsRange} setRange={setMetricsRange} />}
                {tab === "pods" && <PodsTab pods={node.pods} />}
                {tab === "cloud" && <CloudTab cloud={cloudInfo} node={node} />}
                {tab === "networking" && <NetworkingTab node={node} cloud={cloudInfo} />}
                {tab === "storage" && <StorageTab node={node} cloud={cloudInfo} />}
                {tab === "tags" && <TagsTab node={node} cloud={cloudInfo} />}
                {tab === "events" && <EventsTab events={node.events} />}
            </div>
        </div>
    );
}

// ===== Details Tab =====
function DetailsTab({ node }: { node: NodeDetail }) {
    return (
        <div className="space-y-4">
            {/* Instance Summary */}
            <Section title="Instance Summary">
                <DetailGrid items={[
                    { label: "Instance Type", value: node.instance_type || "—", color: "#7170ff" },
                    { label: "Availability Zone", value: node.availability_zone || "—" },
                    { label: "Region", value: node.region || "—" },
                    { label: "Provider ID", value: node.provider_id || "—" },
                    { label: "Kubernetes Version", value: node.kubernetes_version || "—", color: "#3fb950" },
                    { label: "Container Runtime", value: node.container_runtime || "—" },
                    { label: "OS Image", value: node.os || "—" },
                    { label: "Architecture", value: node.architecture || "—" },
                    { label: "Kernel", value: node.kernel || "—" },
                    { label: "Internal IP", value: node.internal_ip || "—", color: "#7170ff" },
                    { label: "External IP", value: node.external_ip || "—" },
                    { label: "Pod CIDR", value: node.pod_cidr || "—" },
                    { label: "Created At", value: node.created_at ? new Date(node.created_at).toLocaleString() : "—" },
                    { label: "Age", value: node.age || "—" },
                    { label: "Status", value: node.status, color: node.status === "Ready" ? "#3fb950" : "#f85149" },
                    { label: "Role", value: node.role },
                ]} />
            </Section>

            {/* Conditions */}
            <Section title="Conditions">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {node.conditions.map(c => (
                        <ConditionBadge key={c.type} label={c.type} ok={c.status === "True" ? c.type === "Ready" : c.type !== "Ready"} reason={c.reason} />
                    ))}
                </div>
            </Section>

            {/* Resource Utilization */}
            <Section title="Resource Utilization">
                <div className="space-y-3">
                    <ResourceBar label="CPU" used={node.cpu_used || "0"} capacity={node.cpu_capacity} percent={node.cpu_percent} color="#22d3ee" />
                    <ResourceBar label="Memory" used={node.memory_used || "0"} capacity={node.memory_capacity} percent={node.memory_percent} color="#a371f7" />
                    <ResourceBar label="Pods" used={String(node.pod_count)} capacity={node.pod_capacity} percent={Math.round((node.pod_count / (parseInt(node.pod_capacity) || 110)) * 100)} color="#3fb950" />
                    <ResourceBar label="Ephemeral Storage" used="—" capacity={node.ephemeral_storage || "—"} percent={0} color="#f0883e" />
                </div>
            </Section>

            {/* Taints */}
            <Section title="Taints">
                {node.taints.length === 0 ? (
                    <p className="text-[11px] text-slate-500">No taints configured on this node.</p>
                ) : (
                    <div className="space-y-1.5">
                        {node.taints.map((t, i) => (
                            <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)]">
                                <span className="text-[11px] font-mono text-amber-300">{t.key}={t.value}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">{t.effect}</span>
                            </div>
                        ))}
                    </div>
                )}
            </Section>

            {/* Images */}
            <Section title={`Cached Images (${node.image_count})`}>
                <div className="max-h-48 overflow-y-auto space-y-1">
                    {node.images.slice(0, 30).map((img, i) => (
                        <p key={i} className="text-[11px] font-mono text-slate-400 truncate">{img}</p>
                    ))}
                    {node.image_count > 30 && (
                        <p className="text-[10px] text-slate-500 mt-2">...and {node.image_count - 30} more</p>
                    )}
                </div>
            </Section>
        </div>
    );
}

// ===== Metrics Tab =====
function MetricsTab({ data, range, setRange }: { data: NodeMetricsHistory | null; range: string; setRange: (r: string) => void }) {
    const ranges = ["1h", "3h", "12h", "1d", "3d", "1w"];

    if (!data) {
        return (
            <div className="py-12 text-center">
                <BarChart3 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Loading metrics...</p>
                <p className="text-xs text-slate-500 mt-1">Fetching time-series data from Prometheus.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Range Selector */}
            <div className="flex items-center justify-between">
                <p className="text-[12px] text-slate-400">Time range</p>
                <div className="flex items-center gap-1">
                    {ranges.map(r => (
                        <button
                            key={r}
                            onClick={() => setRange(r)}
                            className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors ${range === r ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" : "text-slate-500 hover:text-slate-300 border border-[rgba(15,23,42,0.10)] hover:border-[rgba(15,23,42,0.14)]"}`}
                        >
                            {r}
                        </button>
                    ))}
                </div>
            </div>

            {/* CPU Utilization */}
            <MetricsChart title="CPU Utilization (%)" data={data.cpu_utilization} color="#22d3ee" unit="%" />

            {/* Memory Utilization */}
            <MetricsChart title="Memory Utilization (%)" data={data.memory_utilization} color="#a371f7" unit="%" />

            {/* Network */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <MetricsChart title="Network In (bytes/s)" data={data.network_in_bytes} color="#7170ff" unit=" B/s" />
                <MetricsChart title="Network Out (bytes/s)" data={data.network_out_bytes} color="#3fb950" unit=" B/s" />
            </div>

            {/* Network Packets */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <MetricsChart title="Network Packets In (count)" data={data.network_packets_in} color="#7170ff" unit="" />
                <MetricsChart title="Network Packets Out (count)" data={data.network_packets_out} color="#3fb950" unit="" />
            </div>

            {/* Disk */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <MetricsChart title="Disk Read IOPS" data={data.disk_read_iops} color="#f0883e" unit=" IOPS" />
                <MetricsChart title="Disk Write IOPS" data={data.disk_write_iops} color="#d29922" unit=" IOPS" />
            </div>

            {/* CPU Credits (T-type instances) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <MetricsChart title="CPU Credit Usage (count)" data={data.cpu_credit_usage} color="#f85149" unit="" />
                <MetricsChart title="CPU Credit Balance (count)" data={data.cpu_credit_balance} color="#3fb950" unit="" />
            </div>

            {/* Metadata Token */}
            <MetricsChart title="Metadata No Token (count)" data={data.metadata_no_token} color="#64748b" unit="" />
        </div>
    );
}

function MetricsChart({ title, data, color, unit }: { title: string; data: MetricsDataPoint[]; color: string; unit: string }) {
    const hasData = data && data.length > 0;
    const chartData = hasData ? data.map(d => ({
        time: new Date(d.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        value: Math.round(d.value * 100) / 100,
    })) : [];

    return (
        <Section title={title}>
            {!hasData ? (
                <div className="h-32 flex items-center justify-center">
                    <p className="text-[11px] text-slate-500">No data available. Prometheus may not be scraping this node.</p>
                </div>
            ) : (
                <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                            <defs>
                                <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.10)" />
                            <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "rgba(15,23,42,0.10)" }} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "rgba(15,23,42,0.10)" }} width={45} />
                            <Tooltip
                                contentStyle={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(15,23,42,0.14)", borderRadius: 8, fontSize: 11 }}
                                labelStyle={{ color: "#64748b" }}
                                itemStyle={{ color }}
                                formatter={(value) => [`${value}${unit}`, ""]}
                            />
                            <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#grad-${color.replace("#", "")})`} dot={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </Section>
    );
}

// ===== Pods Tab =====
function PodsTab({ pods }: { pods: NodeDetail["pods"] }) {
    if (!pods || pods.length === 0) {
        return <p className="text-sm text-slate-500 py-8 text-center">No pods found on this node.</p>;
    }
    return (
        <div className="rounded-xl border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] overflow-hidden">
            <table className="w-full text-left">
                <thead>
                    <tr className="border-b border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)]/60">
                        <th className="px-4 py-2.5 text-[10px] font-semibold uppercase text-[#64748b]">Pod</th>
                        <th className="px-4 py-2.5 text-[10px] font-semibold uppercase text-[#64748b]">Namespace</th>
                        <th className="px-4 py-2.5 text-[10px] font-semibold uppercase text-[#64748b]">Status</th>
                        <th className="px-4 py-2.5 text-[10px] font-semibold uppercase text-[#64748b]">CPU Req</th>
                        <th className="px-4 py-2.5 text-[10px] font-semibold uppercase text-[#64748b]">Memory Req</th>
                        <th className="px-4 py-2.5 text-[10px] font-semibold uppercase text-[#64748b]">Restarts</th>
                        <th className="px-4 py-2.5 text-[10px] font-semibold uppercase text-[#64748b]">Containers</th>
                        <th className="px-4 py-2.5 text-[10px] font-semibold uppercase text-[#64748b]">Age</th>
                    </tr>
                </thead>
                <tbody>
                    {pods.map(p => {
                        const statusColor = p.status === "Running" ? "#3fb950" : p.status === "Pending" ? "#f0883e" : "#f85149";
                        const restartColor = p.restarts > 5 ? "#f85149" : p.restarts > 0 ? "#f0883e" : "#3fb950";
                        return (
                            <tr key={p.name} className="border-b border-[rgba(15,23,42,0.10)] hover:bg-white/[0.02]">
                                <td className="px-4 py-2.5 text-[12px] font-mono text-slate-200 truncate max-w-[240px]">{p.name}</td>
                                <td className="px-4 py-2.5 text-[11px] text-slate-400 font-mono">{p.namespace}</td>
                                <td className="px-4 py-2.5">
                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: statusColor }}>
                                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
                                        {p.status}
                                    </span>
                                </td>
                                <td className="px-4 py-2.5 text-[11px] text-slate-400 font-mono">{p.cpu || "—"}</td>
                                <td className="px-4 py-2.5 text-[11px] text-slate-400 font-mono">{p.memory || "—"}</td>
                                <td className="px-4 py-2.5 text-[12px] font-mono font-semibold" style={{ color: restartColor }}>{p.restarts}</td>
                                <td className="px-4 py-2.5 text-[11px] text-slate-400">{p.containers}</td>
                                <td className="px-4 py-2.5 text-[11px] text-slate-400">{p.age}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ===== Cloud Tab =====
function CloudTab({ cloud, node }: { cloud: NodeCloudResponse | null; node: NodeDetail }) {
    if (!cloud || !cloud.available || !cloud.instance) {
        return (
            <div className="space-y-4">
                <div className="py-12 text-center">
                    <Cloud className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-sm text-slate-400">
                        {cloud?.message || "AWS EC2 details unavailable"}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                        Ensure AWS credentials are configured (IAM role or access keys) with ec2:DescribeInstances permission.
                    </p>
                    {cloud?.instance_id && (
                        <p className="text-xs text-blue-400 font-mono mt-2">Instance ID: {cloud.instance_id}</p>
                    )}
                </div>
            </div>
        );
    }

    const inst = cloud.instance;

    return (
        <div className="space-y-4">
            {/* Instance Summary */}
            <Section title="Instance Summary">
                <DetailGrid items={[
                    { label: "Instance ID", value: inst.instance_id, color: "#7170ff" },
                    { label: "Instance Type", value: inst.instance_type, color: "#3fb950" },
                    { label: "AMI ID", value: inst.ami_id },
                    { label: "AMI Name", value: inst.ami_name || "—" },
                    { label: "AMI Location", value: inst.ami_location || "—" },
                    { label: "Platform", value: inst.platform },
                    { label: "State", value: inst.state, color: inst.state === "running" ? "#3fb950" : "#f85149" },
                    { label: "Lifecycle", value: inst.lifecycle },
                    { label: "Launch Time", value: inst.launch_time ? new Date(inst.launch_time).toLocaleString() : "—" },
                    { label: "vCPUs", value: String(inst.vcpus || "—") },
                    { label: "Architecture", value: inst.architecture },
                    { label: "Virtualization", value: inst.virtualization_type },
                    { label: "Hypervisor", value: inst.hypervisor },
                    { label: "Tenancy", value: inst.tenancy },
                    { label: "Boot Mode", value: inst.boot_mode || "—" },
                    { label: "Monitoring", value: inst.monitoring || "disabled" },
                    { label: "EBS Optimized", value: inst.ebs_optimized ? "Yes" : "No" },
                    { label: "Termination Protection", value: inst.termination_protection ? "Enabled" : "Disabled" },
                    { label: "Stop Protection", value: inst.stop_protection ? "Enabled" : "Disabled" },
                    { label: "Key Pair", value: inst.key_pair || "—" },
                    { label: "IAM Role", value: inst.iam_role || "—" },
                    { label: "Credit Specification", value: inst.credit_specification || "—" },
                    { label: "Usage Operation", value: inst.usage_operation || "—" },
                    { label: "Owner", value: inst.owner || "—" },
                    { label: "Reservation", value: inst.reservation || "—" },
                ]} />
            </Section>

            {/* Security Groups */}
            <Section title="Security Groups">
                {inst.security_groups?.length > 0 ? (
                    <div className="space-y-1.5">
                        {inst.security_groups.map(sg => (
                            <div key={sg.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)]">
                                <Shield className="w-3.5 h-3.5 text-blue-400" />
                                <span className="text-[11px] font-mono text-blue-300">{sg.id}</span>
                                <span className="text-[11px] text-slate-400">({sg.name})</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-[11px] text-slate-500">No security groups found.</p>
                )}
            </Section>

            {/* Status Checks */}
            <Section title="Status Checks">
                <div className="grid grid-cols-2 gap-3">
                    <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border ${inst.status_checks.system === "passed" || inst.status_checks.system === "ok" ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"}`}>
                        {inst.status_checks.system === "passed" || inst.status_checks.system === "ok" ? <CheckCircle className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                        <div>
                            <p className="text-[12px] font-medium text-slate-200">System Status Check</p>
                            <p className="text-[10px] text-slate-400 capitalize">{inst.status_checks.system}</p>
                        </div>
                    </div>
                    <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border ${inst.status_checks.instance === "passed" || inst.status_checks.instance === "ok" ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"}`}>
                        {inst.status_checks.instance === "passed" || inst.status_checks.instance === "ok" ? <CheckCircle className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                        <div>
                            <p className="text-[12px] font-medium text-slate-200">Instance Status Check</p>
                            <p className="text-[10px] text-slate-400 capitalize">{inst.status_checks.instance}</p>
                        </div>
                    </div>
                </div>
            </Section>
        </div>
    );
}

// ===== Networking Tab =====
function NetworkingTab({ node, cloud }: { node: NodeDetail; cloud: NodeCloudResponse | null }) {
    const inst = cloud?.instance;
    return (
        <div className="space-y-4">
            <Section title="IP Addresses">
                <DetailGrid items={[
                    { label: "Internal IP", value: node.internal_ip || "—", color: "#7170ff" },
                    { label: "External IP", value: node.external_ip || "—", color: "#7170ff" },
                    { label: "Pod CIDR", value: node.pod_cidr || "—" },
                    ...(inst ? [
                        { label: "Public IPv4", value: inst.public_ip || "—", color: "#3fb950" },
                        { label: "Private IPv4", value: inst.private_ip || "—" },
                        { label: "Public DNS", value: inst.public_dns || "—" },
                        { label: "Private DNS", value: inst.private_dns || "—" },
                    ] : []),
                ]} />
            </Section>

            {inst && (
                <>
                    <Section title="VPC & Subnet">
                        <DetailGrid items={[
                            { label: "VPC ID", value: inst.vpc_id || "—", color: "#7170ff" },
                            { label: "VPC Name", value: inst.vpc_name || "—" },
                            { label: "Subnet ID", value: inst.subnet_id || "—" },
                            { label: "Availability Zone", value: inst.availability_zone || "—" },
                            { label: "AZ ID", value: inst.az_id || "—" },
                        ]} />
                    </Section>

                    <Section title={`Network Interfaces (${inst.network_interfaces?.length || 0})`}>
                        {inst.network_interfaces?.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-[rgba(15,23,42,0.10)]">
                                            <th className="px-3 py-2 text-[10px] font-semibold uppercase text-[#64748b]">Interface ID</th>
                                            <th className="px-3 py-2 text-[10px] font-semibold uppercase text-[#64748b]">Private IP</th>
                                            <th className="px-3 py-2 text-[10px] font-semibold uppercase text-[#64748b]">Public IP</th>
                                            <th className="px-3 py-2 text-[10px] font-semibold uppercase text-[#64748b]">Subnet</th>
                                            <th className="px-3 py-2 text-[10px] font-semibold uppercase text-[#64748b]">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {inst.network_interfaces.map(ni => (
                                            <tr key={ni.id} className="border-b border-[rgba(15,23,42,0.10)]/50">
                                                <td className="px-3 py-2 text-[11px] font-mono text-blue-300">{ni.id}</td>
                                                <td className="px-3 py-2 text-[11px] font-mono text-slate-300">{ni.private_ip}</td>
                                                <td className="px-3 py-2 text-[11px] font-mono text-slate-300">{ni.public_ip || "—"}</td>
                                                <td className="px-3 py-2 text-[11px] font-mono text-slate-400">{ni.subnet_id}</td>
                                                <td className="px-3 py-2 text-[11px] text-green-400">{ni.status}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-[11px] text-slate-500">No network interfaces data available.</p>
                        )}
                    </Section>
                </>
            )}
        </div>
    );
}

// ===== Storage Tab =====
function StorageTab({ node, cloud }: { node: NodeDetail; cloud: NodeCloudResponse | null }) {
    const inst = cloud?.instance;
    return (
        <div className="space-y-4">
            <Section title="Storage Capacity">
                <DetailGrid items={[
                    { label: "Ephemeral Storage", value: node.ephemeral_storage || "—" },
                    ...(inst ? [
                        { label: "Root Device", value: inst.root_device_name || "—" },
                        { label: "Root Device Type", value: inst.root_device_type || "—" },
                        { label: "Root Volume Size", value: inst.root_volume_size ? `${inst.root_volume_size} GiB` : "—" },
                        { label: "EBS Optimized", value: inst.ebs_optimized ? "Yes" : "No" },
                    ] : []),
                ]} />
            </Section>

            {inst && inst.volumes?.length > 0 && (
                <Section title={`Block Devices (${inst.volumes.length})`}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-[rgba(15,23,42,0.10)]">
                                    <th className="px-3 py-2 text-[10px] font-semibold uppercase text-[#64748b]">Volume ID</th>
                                    <th className="px-3 py-2 text-[10px] font-semibold uppercase text-[#64748b]">Device</th>
                                    <th className="px-3 py-2 text-[10px] font-semibold uppercase text-[#64748b]">Size (GiB)</th>
                                    <th className="px-3 py-2 text-[10px] font-semibold uppercase text-[#64748b]">Type</th>
                                    <th className="px-3 py-2 text-[10px] font-semibold uppercase text-[#64748b]">IOPS</th>
                                    <th className="px-3 py-2 text-[10px] font-semibold uppercase text-[#64748b]">Encrypted</th>
                                    <th className="px-3 py-2 text-[10px] font-semibold uppercase text-[#64748b]">State</th>
                                </tr>
                            </thead>
                            <tbody>
                                {inst.volumes.map(vol => (
                                    <tr key={vol.id} className="border-b border-[rgba(15,23,42,0.10)]/50">
                                        <td className="px-3 py-2 text-[11px] font-mono text-blue-300">{vol.id}</td>
                                        <td className="px-3 py-2 text-[11px] font-mono text-slate-300">{vol.device}</td>
                                        <td className="px-3 py-2 text-[11px] font-mono text-slate-300">{vol.size_gb}</td>
                                        <td className="px-3 py-2 text-[11px] text-slate-300">{vol.type}</td>
                                        <td className="px-3 py-2 text-[11px] text-slate-400">{vol.iops || "—"}</td>
                                        <td className="px-3 py-2 text-[11px]">
                                            {vol.encrypted ? <span className="text-green-400">Yes</span> : <span className="text-amber-400">No</span>}
                                        </td>
                                        <td className="px-3 py-2 text-[11px] text-green-400">{vol.state || "in-use"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Section>
            )}

            {(!inst || !inst.volumes?.length) && (
                <div className="py-8 text-center">
                    <HardDrive className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-sm text-slate-400">Volume details require AWS SDK integration</p>
                    <p className="text-xs text-slate-500 mt-1">Configure AWS credentials for EBS volume information.</p>
                </div>
            )}
        </div>
    );
}

// ===== Tags Tab =====
function TagsTab({ node, cloud }: { node: NodeDetail; cloud: NodeCloudResponse | null }) {
    const inst = cloud?.instance;
    const k8sLabels = node.labels || {};
    const awsTags = inst?.tags || {};

    return (
        <div className="space-y-4">
            {/* AWS Tags */}
            {Object.keys(awsTags).length > 0 && (
                <Section title={`AWS Instance Tags (${Object.keys(awsTags).length})`}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-[rgba(15,23,42,0.10)]">
                                    <th className="px-3 py-2 text-[10px] font-semibold uppercase text-[#64748b]">Key</th>
                                    <th className="px-3 py-2 text-[10px] font-semibold uppercase text-[#64748b]">Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(awsTags).map(([key, value]) => (
                                    <tr key={key} className="border-b border-[rgba(15,23,42,0.10)]/50 hover:bg-white/[0.02]">
                                        <td className="px-3 py-2 text-[11px] font-mono font-semibold text-amber-300">{key}</td>
                                        <td className="px-3 py-2 text-[11px] font-mono text-slate-300">{value}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Section>
            )}

            {/* K8s Labels */}
            <Section title={`Kubernetes Labels (${Object.keys(k8sLabels).length})`}>
                {Object.keys(k8sLabels).length > 0 ? (
                    <div className="overflow-x-auto max-h-72 overflow-y-auto">
                        <table className="w-full text-left">
                            <thead className="sticky top-0 bg-[rgba(255,255,255,0.02)]">
                                <tr className="border-b border-[rgba(15,23,42,0.10)]">
                                    <th className="px-3 py-2 text-[10px] font-semibold uppercase text-[#64748b]">Key</th>
                                    <th className="px-3 py-2 text-[10px] font-semibold uppercase text-[#64748b]">Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(k8sLabels).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => (
                                    <tr key={key} className="border-b border-[rgba(15,23,42,0.10)]/50 hover:bg-white/[0.02]">
                                        <td className="px-3 py-2 text-[11px] font-mono text-blue-300">{key}</td>
                                        <td className="px-3 py-2 text-[11px] font-mono text-slate-300">{value}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-[11px] text-slate-500">No labels found.</p>
                )}
            </Section>

            {/* K8s Annotations */}
            {node.annotations && Object.keys(node.annotations).length > 0 && (
                <Section title={`Kubernetes Annotations (${Object.keys(node.annotations).length})`}>
                    <div className="overflow-x-auto max-h-48 overflow-y-auto">
                        <table className="w-full text-left">
                            <thead className="sticky top-0 bg-[rgba(255,255,255,0.02)]">
                                <tr className="border-b border-[rgba(15,23,42,0.10)]">
                                    <th className="px-3 py-2 text-[10px] font-semibold uppercase text-[#64748b]">Key</th>
                                    <th className="px-3 py-2 text-[10px] font-semibold uppercase text-[#64748b]">Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(node.annotations).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => (
                                    <tr key={key} className="border-b border-[rgba(15,23,42,0.10)]/50 hover:bg-white/[0.02]">
                                        <td className="px-3 py-2 text-[11px] font-mono text-purple-300 break-all">{key}</td>
                                        <td className="px-3 py-2 text-[11px] font-mono text-slate-300 truncate max-w-[400px]">{value}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Section>
            )}
        </div>
    );
}

// ===== Events Tab =====
function EventsTab({ events }: { events: NodeDetail["events"] }) {
    if (!events || events.length === 0) {
        return (
            <div className="py-12 text-center">
                <Activity className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-400">No recent events for this node</p>
                <p className="text-xs text-slate-500 mt-1">K8s events appear here when the node state changes.</p>
            </div>
        );
    }
    return (
        <div className="rounded-xl border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] overflow-hidden">
            <table className="w-full text-left">
                <thead>
                    <tr className="border-b border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)]/60">
                        <th className="px-4 py-2.5 text-[10px] font-semibold uppercase text-[#64748b]">Type</th>
                        <th className="px-4 py-2.5 text-[10px] font-semibold uppercase text-[#64748b]">Reason</th>
                        <th className="px-4 py-2.5 text-[10px] font-semibold uppercase text-[#64748b]">Message</th>
                        <th className="px-4 py-2.5 text-[10px] font-semibold uppercase text-[#64748b]">Count</th>
                        <th className="px-4 py-2.5 text-[10px] font-semibold uppercase text-[#64748b]">Last Seen</th>
                        <th className="px-4 py-2.5 text-[10px] font-semibold uppercase text-[#64748b]">Source</th>
                    </tr>
                </thead>
                <tbody>
                    {events.map((ev, i) => {
                        const typeColor = ev.type === "Warning" ? "#f0883e" : ev.type === "Normal" ? "#3fb950" : "#64748b";
                        return (
                            <tr key={i} className="border-b border-[rgba(15,23,42,0.10)] hover:bg-white/[0.02]">
                                <td className="px-4 py-2.5">
                                    <span className="text-[11px] font-medium" style={{ color: typeColor }}>{ev.type}</span>
                                </td>
                                <td className="px-4 py-2.5 text-[11px] font-medium text-slate-200">{ev.reason}</td>
                                <td className="px-4 py-2.5 text-[11px] text-slate-400 max-w-[300px] truncate">{ev.message}</td>
                                <td className="px-4 py-2.5 text-[11px] font-mono text-slate-300">{ev.count}</td>
                                <td className="px-4 py-2.5 text-[11px] text-slate-400">
                                    {ev.last ? new Date(ev.last).toLocaleString() : "—"}
                                </td>
                                <td className="px-4 py-2.5 text-[11px] text-slate-500">{ev.component}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ===== Shared Components =====

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-4">
            <h3 className="text-[13px] font-semibold text-slate-200 mb-3 flex items-center gap-2">
                {title}
            </h3>
            {children}
        </div>
    );
}

function DetailGrid({ items }: { items: { label: string; value: string; color?: string }[] }) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
            {items.map(item => (
                <div key={item.label} className="space-y-0.5 min-w-0">
                    <p className="text-[10px] text-[#64748b] font-medium">{item.label}</p>
                    <p className="text-[12px] font-mono truncate" style={{ color: item.color || "#f7f8f8" }} title={item.value}>{item.value}</p>
                </div>
            ))}
        </div>
    );
}

function ConditionBadge({ label, ok, reason }: { label: string; ok: boolean; reason?: string }) {
    return (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${ok ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"}`} title={reason}>
            {ok ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}
            <span className={`text-[11px] font-medium ${ok ? "text-green-300" : "text-red-300"}`}>{label}</span>
        </div>
    );
}

function ResourceBar({ label, used, capacity, percent, color }: { label: string; used: string; capacity: string; percent: number; color: string }) {
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">{label}</span>
                <span className="text-[11px] font-mono" style={{ color }}>{used} / {capacity} ({percent}%)</span>
            </div>
            <div className="h-2 rounded-full bg-[rgba(15,23,42,0.10)] overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, percent)}%`, background: color, boxShadow: `0 0 6px ${color}40` }} />
            </div>
        </div>
    );
}

function KPICard({ label, value, sub, color, percent }: { label: string; value: string; sub: string; color: string; percent: number }) {
    const r = 20;
    const c = 2 * Math.PI * r;
    const offset = c - (Math.min(100, percent) / 100) * c;
    return (
        <div className="rounded-xl border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-4 hover:border-[rgba(15,23,42,0.14)] transition-colors" style={{ background: `radial-gradient(circle at 90% 20%, ${color}15 0%, transparent 50%), rgba(255,255,255,0.02)` }}>
            <p className="text-[10px] text-[#64748b] font-medium mb-2">{label}</p>
            <div className="flex items-end justify-between">
                <div>
                    <p className="text-[22px] font-bold font-mono leading-none" style={{ color }}>{value}</p>
                    <p className="text-[10px] text-[#94a3b8] mt-1 font-mono">{sub}</p>
                </div>
                <svg width="44" height="44" viewBox="0 0 44 44">
                    <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(15,23,42,0.10)" strokeWidth="3.5" />
                    <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 22 22)" style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
                </svg>
            </div>
        </div>
    );
}
