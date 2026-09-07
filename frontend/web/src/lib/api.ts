/**
 * Tagent API Client
 * Uses Next.js API proxy — browser calls /api/proxy/... on same origin.
 * No CORS, no localhost issues, no port-forward for API Gateway needed.
 */

const API_PREFIX = "/api/proxy";

export class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
    // Convert /api/v1/resources → /api/proxy/resources
    const proxyPath = path.replace("/api/v1/", "");
    const url = `${API_PREFIX}/${proxyPath}`;
    try {
        const res = await fetch(url, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(options?.headers || {}),
            },
            cache: "no-store",
        });
        if (!res.ok) {
            throw new ApiError(`API ${path}: ${res.statusText}`, res.status);
        }
        return res.json() as Promise<T>;
    } catch (err) {
        if (err instanceof ApiError) throw err;
        throw new ApiError(`Cannot reach API at ${url}`, 0);
    }
}

// ===== Cluster / Discovery =====

export interface ClusterSummary {
    total_nodes: number;
    ready_nodes: number;
    total_pods: number;
    running_pods: number;
    failed_pods: number;
    total_deployments: number;
    total_services: number;
}

export interface PodInfo {
    name: string;
    namespace: string;
    status: string;
    restarts: number;
    cpu_request: string;
    memory_request: string;
    cpu_used: string;
    memory_used: string;
    node: string;
    age: string;
    containers: number;
}

export interface NodeInfo {
    name: string;
    status: string;
    role: string;
    cpu_capacity: string;
    memory_capacity: string;
    pod_capacity: string;
    cpu_used: string;
    memory_used: string;
    pod_count: number;
    internal_ip: string;
    external_ip: string;
    age: string;
}

export interface ClusterState {
    scanned_at: string;
    nodes: NodeInfo[];
    pods: PodInfo[];
    deployments: any[];
    services: any[];
    namespaces: string[];
    summary: ClusterSummary;
}

export interface DeploymentInfo {
    name: string;
    namespace: string;
    replicas: number;
    ready: number;
    available: number;
    age: string;
}

export interface ServiceInfo {
    name: string;
    namespace: string;
    type: string;
    cluster_ip: string;
    ports: string;
}

export type Severity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "active" | "investigating" | "resolved";

export interface Incident {
    id: string;
    title: string;
    severity: Severity;
    status: IncidentStatus;
    service: string;
    namespace: string;
    startedAt: string;
    rootCause?: string;
    confidence?: number;
    blastRadius?: string[];
    evidence?: string[];
}

export interface IncidentListResponse {
    incidents: Incident[];
    total: number;
}

export interface MetricsSummary {
    cluster_cpu_percent: number;
    cluster_memory_percent: number;
    pod_metrics: Array<{
        pod: string;
        namespace: string;
        cpu_cores: number;
        memory_bytes: number;
    }> | null;
    node_metrics: Array<{
        node: string;
        cpu_percent: number;
        memory_percent: number;
        disk_percent: number;
    }> | null;
    alerts: Array<{
        name: string;
        severity: string;
        message: string;
        since: string;
    }> | null;
}

export interface RemediationRequest {
    action: "restart-pod" | "scale-deployment" | "rollback-deployment";
    namespace: string;
    target: string;
    dry_run: boolean;
}

export interface RemediationResult {
    action: string;
    target: string;
    status: string;
    message: string;
    timestamp: string;
    dry_run: boolean;
}

export interface RemediationHistoryResponse {
    history: RemediationResult[];
    total: number;
}

export interface ReportsResponse {
    reports: Array<{
        id?: string;
        title?: string;
        severity?: string;
        duration?: string;
        resolved_at?: string;
        content?: string;
    }>;
    total: number;
}

export interface AutoscalingSummary {
    hpas: Array<{
        name: string;
        namespace: string;
        current: number;
        desired: number;
        min: number;
        max: number;
        status: string;
        age: string;
    }>;
    vpas: any[];
    events: any[];
}

export interface CostSummary {
    monthly_spend: string;
    potential_savings: string;
    items: Array<{
        name: string;
        kind: string;
        namespace: string;
        estimate: string;
        basis: string;
    }>;
    recommendations: Array<{
        title: string;
        saving: string;
        detail: string;
    }>;
}

export interface NightGuardianConfig {
    enabled: boolean;
    auto_fix: boolean;
    confidence: number;
    interval_seconds: number;
    min_restarts: number;
    protected_namespace: string;
}

export interface NightGuardianReport {
    id: string;
    incident_id: string;
    title: string;
    namespace: string;
    target: string;
    detected_status: string;
    confidence: number;
    action: string;
    result: RemediationResult;
    recommendation: string;
    created_at: string;
    dry_run: boolean;
    evidence: string[];
}

export interface NightGuardianRun {
    started_at: string;
    finished_at: string;
    findings: number;
    fixed: number;
    reports: NightGuardianReport[];
}

export interface NightGuardianStatus {
    config: NightGuardianConfig;
    latest_run: NightGuardianRun;
    run_count: number;
    report_count: number;
    mode: string;
}

export interface NightGuardianReportsResponse {
    reports: NightGuardianReport[];
    total: number;
}

export async function getClusterState(): Promise<ClusterState> {
    return request<ClusterState>("/api/v1/resources");
}

export async function getClusterSummary(): Promise<ClusterSummary> {
    return request<ClusterSummary>("/api/v1/clusters");
}

export interface ClusterInfo {
    cluster_name: string;
    environment: string;
    nodes: number;
    pods: number;
    provider: string;
    region: string;
}

export async function getClusterInfo(): Promise<ClusterInfo> {
    return request<ClusterInfo>("/api/v1/cluster-info");
}

export async function getPods(namespace?: string): Promise<PodInfo[]> {
    const path = namespace ? `/api/v1/pods?namespace=${namespace}` : "/api/v1/pods";
    return request<PodInfo[]>(path);
}

export async function getNodes(): Promise<NodeInfo[]> {
    return request<NodeInfo[]>("/api/v1/nodes");
}

// ===== Node Detail =====

export interface NodeCondition {
    type: string;
    status: string;
    reason: string;
    message: string;
}

export interface NodePodDetail {
    name: string;
    namespace: string;
    status: string;
    cpu: string;
    memory: string;
    restarts: number;
    age: string;
    containers: number;
}

export interface NodeTaint {
    key: string;
    value: string;
    effect: string;
}

export interface NodeEvent {
    type: string;
    reason: string;
    message: string;
    count: number;
    first: string;
    last: string;
    component: string;
}

export interface NodeDetail {
    name: string;
    status: string;
    role: string;
    kubernetes_version: string;
    container_runtime: string;
    os: string;
    os_type: string;
    architecture: string;
    kernel: string;
    internal_ip: string;
    external_ip: string;
    pod_cidr: string;
    provider_id: string;
    instance_type: string;
    availability_zone: string;
    region: string;
    created_at: string;
    age: string;
    cpu_capacity: string;
    memory_capacity: string;
    pod_capacity: string;
    ephemeral_storage: string;
    cpu_used: string;
    cpu_percent: number;
    memory_used: string;
    memory_percent: number;
    pod_count: number;
    pods: NodePodDetail[];
    conditions: NodeCondition[];
    labels: Record<string, string>;
    annotations: Record<string, string>;
    taints: NodeTaint[];
    images: string[];
    image_count: number;
    events: NodeEvent[];
}

export interface CloudSecurityGroup {
    id: string;
    name: string;
}

export interface CloudVolume {
    id: string;
    device: string;
    size_gb: number;
    type: string;
    encrypted: boolean;
    state: string;
    iops: number;
}

export interface CloudNetworkInterface {
    id: string;
    private_ip: string;
    public_ip: string;
    subnet_id: string;
    vpc_id: string;
    mac_address: string;
    status: string;
}

export interface CloudStatusChecks {
    system: string;
    instance: string;
}

export interface EC2InstanceDetail {
    instance_id: string;
    instance_type: string;
    ami_id: string;
    ami_name: string;
    ami_location: string;
    platform: string;
    launch_time: string;
    state: string;
    lifecycle: string;
    vpc_id: string;
    vpc_name: string;
    subnet_id: string;
    availability_zone: string;
    az_id: string;
    public_ip: string;
    private_ip: string;
    public_dns: string;
    private_dns: string;
    security_groups: CloudSecurityGroup[];
    key_pair: string;
    iam_role: string;
    monitoring: string;
    ebs_optimized: boolean;
    root_device_name: string;
    root_device_type: string;
    root_volume_size: number;
    volumes: CloudVolume[];
    network_interfaces: CloudNetworkInterface[];
    tags: Record<string, string>;
    status_checks: CloudStatusChecks;
    vcpus: number;
    architecture: string;
    hypervisor: string;
    virtualization_type: string;
    tenancy: string;
    reservation: string;
    owner: string;
    region: string;
    boot_mode: string;
    termination_protection: boolean;
    stop_protection: boolean;
    credit_specification: string;
    usage_operation: string;
}

export interface NodeCloudResponse {
    available: boolean;
    message?: string;
    instance_id?: string;
    instance?: EC2InstanceDetail;
}

export interface MetricsDataPoint {
    timestamp: string;
    value: number;
}

export interface NodeMetricsHistory {
    node: string;
    range: string;
    cpu_utilization: MetricsDataPoint[];
    memory_utilization: MetricsDataPoint[];
    network_in_bytes: MetricsDataPoint[];
    network_out_bytes: MetricsDataPoint[];
    network_packets_in: MetricsDataPoint[];
    network_packets_out: MetricsDataPoint[];
    disk_read_iops: MetricsDataPoint[];
    disk_write_iops: MetricsDataPoint[];
    disk_usage_percent: MetricsDataPoint[];
    metadata_no_token: MetricsDataPoint[];
    cpu_credit_usage: MetricsDataPoint[];
    cpu_credit_balance: MetricsDataPoint[];
}

export async function getNodeDetail(name: string): Promise<NodeDetail> {
    return request<NodeDetail>(`/api/v1/nodes/${encodeURIComponent(name)}`);
}

export async function getNodeCloudInfo(name: string): Promise<NodeCloudResponse> {
    return request<NodeCloudResponse>(`/api/v1/nodes/${encodeURIComponent(name)}/cloud`);
}

export async function getNodeMetrics(name: string, range: string = "1h"): Promise<NodeMetricsHistory> {
    return request<NodeMetricsHistory>(`/api/v1/metrics/node/${encodeURIComponent(name)}?range=${range}`);
}

export async function getDeployments(): Promise<DeploymentInfo[]> {
    return request<DeploymentInfo[]>("/api/v1/deployments");
}

export async function getServices(): Promise<ServiceInfo[]> {
    return request<ServiceInfo[]>("/api/v1/services");
}

// ===== Incidents =====

export async function getIncidents(): Promise<IncidentListResponse> {
    return request<IncidentListResponse>("/api/v1/incidents");
}

export async function getIncident(id: string): Promise<Incident> {
    return request<Incident>(`/api/v1/incidents/${encodeURIComponent(id)}`);
}

// ===== Metrics / Monitoring =====

export async function getMetricsSummary(): Promise<MetricsSummary> {
    return request<MetricsSummary>("/api/v1/metrics/summary");
}

// ===== Network Metrics =====

export interface NetworkMetrics {
    total_bandwidth: string;
    receive_bytes_per_sec: number;
    transmit_bytes_per_sec: number;
    receive_packets_per_sec: number;
    transmit_packets_per_sec: number;
    receive_errors_per_sec: number;
    transmit_errors_per_sec: number;
    receive_dropped_per_sec: number;
    transmit_dropped_per_sec: number;
    node_receive: Array<{ node: string; bytes_per_sec: number; formatted: string }> | null;
    node_transmit: Array<{ node: string; bytes_per_sec: number; formatted: string }> | null;
}

export async function getNetworkMetrics(): Promise<NetworkMetrics> {
    return request<NetworkMetrics>("/api/v1/metrics/network");
}

// ===== Traffic Telemetry (Service Mesh) =====

export interface TrafficMetrics {
    requests_per_sec: number;
    errors_per_sec: number;
    error_rate_percent: number;
    p50_latency_ms: number;
    p95_latency_ms: number;
    p99_latency_ms: number;
    success_rate: number;
    throughput_bytes: number;
    throughput: string;
    service_traffic: Array<{ node: string; bytes_per_sec: number; formatted: string }> | null;
}

export async function getTrafficMetrics(): Promise<TrafficMetrics> {
    return request<TrafficMetrics>("/api/v1/metrics/traffic");
}

// ===== Log Search (Loki) =====

export interface LogSearchResult {
    entries: Array<{ timestamp: string; line: string; labels: Record<string, string> }>;
    total: number;
    query: string;
    source: string;
}

export async function searchLogs(query: string, namespace?: string, start?: string, end?: string, limit?: number): Promise<LogSearchResult> {
    return request<LogSearchResult>("/api/v1/logs/search", {
        method: "POST",
        body: JSON.stringify({ query, namespace, start, end, limit: limit || 100 }),
    });
}

// ===== Distributed Tracing (Jaeger) =====

export interface TraceSpan {
    traceID: string;
    spanID: string;
    operationName: string;
    serviceName: string;
    duration: number;
    startTime: number;
    tags: Record<string, string>;
}

export interface TraceInfo {
    traceID: string;
    spans: TraceSpan[];
    services: string[];
    duration: number;
    startTime: number;
    spanCount: number;
}

export interface TraceSearchResult {
    traces: TraceInfo[];
    total: number;
    source: string;
}

export async function getTraces(service?: string, operation?: string, minDuration?: string): Promise<TraceSearchResult> {
    const params = new URLSearchParams();
    if (service) params.set("service", service);
    if (operation) params.set("operation", operation);
    if (minDuration) params.set("minDuration", minDuration);
    const query = params.toString();
    return request<TraceSearchResult>(`/api/v1/traces${query ? "?" + query : ""}`);
}

export async function getTrace(traceID: string): Promise<TraceInfo> {
    return request<TraceInfo>(`/api/v1/traces/${encodeURIComponent(traceID)}`);
}

export async function getTraceServices(): Promise<{ services: string[]; source: string }> {
    return request<{ services: string[]; source: string }>("/api/v1/traces/services");
}

// ===== Remediation =====

export async function executeRemediation(payload: RemediationRequest): Promise<RemediationResult> {
    return request<RemediationResult>("/api/v1/remediation/execute", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function getRemediationHistory(): Promise<RemediationHistoryResponse> {
    return request<RemediationHistoryResponse>("/api/v1/remediation/history");
}

// ===== Reports =====

export async function getReports(): Promise<ReportsResponse> {
    return request<ReportsResponse>("/api/v1/reports");
}

// ===== Autoscaling / Cost =====

export async function getAutoscaling(): Promise<AutoscalingSummary> {
    return request<AutoscalingSummary>("/api/v1/autoscaling");
}

export async function getCostSummary(): Promise<CostSummary> {
    return request<CostSummary>("/api/v1/cost/summary");
}

// ===== Night Guardian =====

export async function getNightGuardianStatus(): Promise<NightGuardianStatus> {
    return request<NightGuardianStatus>("/api/v1/night-guardian/status");
}

export async function updateNightGuardianConfig(config: NightGuardianConfig): Promise<NightGuardianConfig> {
    return request<NightGuardianConfig>("/api/v1/night-guardian/config", {
        method: "PUT",
        body: JSON.stringify(config),
    });
}

export async function runNightGuardianNow(): Promise<NightGuardianRun> {
    return request<NightGuardianRun>("/api/v1/night-guardian/run", {
        method: "POST",
        body: JSON.stringify({}),
    });
}

export async function getNightGuardianReports(): Promise<NightGuardianReportsResponse> {
    return request<NightGuardianReportsResponse>("/api/v1/night-guardian/reports");
}

// ===== AI Chat =====

export interface ChatResponse {
    response: string;
    model: string;
    context_source: string;
}

export async function sendChat(message: string): Promise<ChatResponse> {
    return request<ChatResponse>("/api/v1/ai/chat", {
        method: "POST",
        body: JSON.stringify({ message }),
    });
}

// ===== Health =====

export interface HealthResponse {
    status: string;
    service: string;
    version: string;
}

export async function getHealth(): Promise<HealthResponse> {
    return request<HealthResponse>("/api/v1/health");
}

// ===== Integrations =====

export interface IntegrationInfo {
    id: string;
    name: string;
    status: string;
    last_sync: string;
    last_sync_at: string;
    setup_type: string;
    health: string;
    env_vars: string[];
    configured: boolean;
}

export interface IntegrationsListResponse {
    integrations: IntegrationInfo[];
    total: number;
    connected: number;
}

export interface IntegrationHealthResponse {
    total_integrations: number;
    healthy: number;
    unhealthy: number;
    overall_health: number;
}

export interface IntegrationTestResponse {
    id: string;
    status: string;
    message: string;
    health: string;
}

export async function getIntegrations(): Promise<IntegrationsListResponse> {
    return request<IntegrationsListResponse>("/api/v1/integrations");
}

export async function getIntegration(id: string): Promise<IntegrationInfo> {
    return request<IntegrationInfo>(`/api/v1/integrations/${encodeURIComponent(id)}`);
}

export async function getIntegrationsHealth(): Promise<IntegrationHealthResponse> {
    return request<IntegrationHealthResponse>("/api/v1/integrations/health");
}

export async function testIntegration(id: string): Promise<IntegrationTestResponse> {
    return request<IntegrationTestResponse>(`/api/v1/integrations/${encodeURIComponent(id)}/test`, {
        method: "POST",
        body: JSON.stringify({}),
    });
}

// ===== Integration Configuration (K8s Secrets) =====

export interface IntegrationFieldDef {
    key: string;
    label: string;
    placeholder: string;
    required: boolean;
    secret: boolean;
}

export interface IntegrationConfigDef {
    id: string;
    name: string;
    setup_type: string;
    fields: IntegrationFieldDef[];
}

export interface IntegrationConfigResponse {
    integration: IntegrationConfigDef;
    saved: Record<string, string>;
    configured: boolean;
}

export async function getIntegrationConfig(id: string): Promise<IntegrationConfigResponse> {
    return request<IntegrationConfigResponse>(`/api/v1/integrations/config/${encodeURIComponent(id)}`);
}

export async function saveIntegrationConfig(id: string, credentials: Record<string, string>): Promise<{ status: string; message: string }> {
    return request<{ status: string; message: string }>(`/api/v1/integrations/config/${encodeURIComponent(id)}`, {
        method: "POST",
        body: JSON.stringify(credentials),
    });
}

export async function deleteIntegrationConfig(id: string): Promise<{ status: string }> {
    return request<{ status: string }>(`/api/v1/integrations/config/${encodeURIComponent(id)}`, {
        method: "DELETE",
    });
}

// ===== Auth & User Management =====

export interface AdminInfo {
    id: string;
    name: string;
    email: string;
    phone: string;
    company: string;
    role: string;
    cluster_name: string;
}

export interface UserInfo {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    permissions: string[];
    token: string;
    created_at: string;
    last_access: string | null;
}

export interface UsersListResponse {
    users: UserInfo[];
    total: number;
}

export async function getAuthStatus(): Promise<{ setup_complete: boolean }> {
    return request<{ setup_complete: boolean }>("/api/v1/auth/status");
}

export async function getAdminInfo(): Promise<AdminInfo> {
    return request<AdminInfo>("/api/v1/auth/admin");
}

export async function setupAdmin(data: { name: string; email: string; phone: string; company: string; role: string; cluster_name: string }): Promise<{ status: string; id: string }> {
    return request<{ status: string; id: string }>("/api/v1/auth/setup", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function getUsers(): Promise<UsersListResponse> {
    return request<UsersListResponse>("/api/v1/users");
}

export async function createUser(data: { name: string; email: string; phone: string; role: string; permissions: string[] }): Promise<{ status: string; id: string; token: string; access_link: string }> {
    return request<{ status: string; id: string; token: string; access_link: string }>("/api/v1/users", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function deleteUser(id: string): Promise<{ status: string }> {
    return request<{ status: string }>(`/api/v1/users/${encodeURIComponent(id)}`, {
        method: "DELETE",
    });
}

export async function verifyUserToken(token: string): Promise<{ valid: boolean; user: { id: string; name: string; email: string; role: string }; company: string }> {
    return request<{ valid: boolean; user: { id: string; name: string; email: string; role: string }; company: string }>(`/api/v1/auth/verify/${encodeURIComponent(token)}`);
}

// ===== Knowledge Base =====

export interface KnowledgeEntry {
    id: string;
    title: string;
    category: string;
    description: string;
    root_cause: string;
    fix_action: string;
    severity: string;
    service: string;
    namespace: string;
    occurrence_count: number;
    success_rate: number;
    last_seen_at: string;
    first_seen_at: string;
    tags: string[];
    metadata: Record<string, any>;
    similarity?: number;
}

export interface KnowledgeListResponse {
    entries: KnowledgeEntry[];
    total: number;
}

export interface KnowledgeSearchResponse {
    results: KnowledgeEntry[];
    query: string;
    model: string;
}

export interface KnowledgeStatsResponse {
    total_entries: number;
    categories: Record<string, number>;
    top_services: Array<{ service: string; entries: number; total_occurrences: number }>;
}

export interface KnowledgeRecommendation {
    action: string;
    target: string;
    confidence: number;
    reasoning: string;
    risk: string;
    similar_incidents?: number;
    knowledge_base_match?: string | null;
}

export interface KnowledgeRecommendResponse {
    recommendations: KnowledgeRecommendation[];
    query: string;
    model: string;
}

export async function getKnowledgeEntries(category?: string): Promise<KnowledgeListResponse> {
    const path = category
        ? `/api/v1/knowledge/entries?category=${encodeURIComponent(category)}`
        : "/api/v1/knowledge/entries";
    return request<KnowledgeListResponse>(path);
}

export async function getKnowledgeStats(): Promise<KnowledgeStatsResponse> {
    return request<KnowledgeStatsResponse>("/api/v1/knowledge/stats");
}

export async function searchKnowledge(query: string, limit?: number): Promise<KnowledgeSearchResponse> {
    return request<KnowledgeSearchResponse>("/api/v1/knowledge/search", {
        method: "POST",
        body: JSON.stringify({ query, limit: limit || 5, threshold: 0.4 }),
    });
}

export async function ingestKnowledge(entry: {
    title: string;
    category: string;
    description: string;
    root_cause: string;
    fix_action: string;
    severity: string;
    service: string;
    namespace: string;
    tags?: string[];
}): Promise<{ status: string; id: string }> {
    return request<{ status: string; id: string }>("/api/v1/knowledge/ingest", {
        method: "POST",
        body: JSON.stringify(entry),
    });
}

export async function autoIngestKnowledge(): Promise<{ status: string; ingested: number; errors: string[] }> {
    return request<{ status: string; ingested: number; errors: string[] }>("/api/v1/knowledge/auto-ingest", {
        method: "POST",
        body: JSON.stringify({}),
    });
}

export async function getKnowledgeRecommendations(query: string, service?: string, namespace?: string): Promise<KnowledgeRecommendResponse> {
    return request<KnowledgeRecommendResponse>("/api/v1/knowledge/recommend", {
        method: "POST",
        body: JSON.stringify({ query, service, namespace }),
    });
}

export async function submitKnowledgeFeedback(entryId: string, success: boolean): Promise<{ status: string }> {
    return request<{ status: string }>("/api/v1/knowledge/feedback", {
        method: "PUT",
        body: JSON.stringify({ entry_id: entryId, success }),
    });
}

// ===== Risk Scoring =====

export interface ServiceRisk {
    service: string;
    namespace: string;
    risk_score: number;
    risk_level: string;
    factors: Array<{ type: string; detail: string; weight: number }>;
    prediction: string;
    recommended_action: string;
}

export interface RiskScoresResponse {
    services: ServiceRisk[];
    total: number;
    calculated_at: string;
}

export interface RiskSummaryResponse {
    overall_score: number;
    overall_level: string;
    total_services_at_risk: number;
    critical_count: number;
    high_count: number;
    medium_count: number;
    low_count: number;
    prevented_incidents: number;
    ai_confidence: number;
    categories: Record<string, number>;
    top_risks: Array<{ service: string; namespace: string; score: number; level: string; top_factor: string }>;
    trend: string;
}

export interface RiskPrediction {
    service: string;
    namespace: string;
    predicted_issue: string;
    probability: number;
    time_horizon: string;
    evidence: string[];
    preventive_action: string;
}

export interface RiskPredictionsResponse {
    predictions: RiskPrediction[];
    total: number;
}

export interface RiskAnalysisResponse {
    service: string;
    analysis: {
        risk_score: number;
        risk_level: string;
        summary: string;
        factors: Array<{ category: string; detail: string; weight: number }>;
        prediction: string;
        time_to_failure?: string;
        recommended_actions: Array<{ action: string; priority: string; impact: string }>;
        dependencies_at_risk?: string[];
    };
    model: string;
}

export async function getRiskScores(): Promise<RiskScoresResponse> {
    return request<RiskScoresResponse>("/api/v1/risks/scores");
}

export async function getRiskSummary(): Promise<RiskSummaryResponse> {
    return request<RiskSummaryResponse>("/api/v1/risks/summary");
}

export async function getRiskPredictions(): Promise<RiskPredictionsResponse> {
    return request<RiskPredictionsResponse>("/api/v1/risks/predictions");
}

export async function analyzeServiceRisk(service: string, namespace?: string): Promise<RiskAnalysisResponse> {
    return request<RiskAnalysisResponse>("/api/v1/risks/analyze", {
        method: "POST",
        body: JSON.stringify({ service, namespace }),
    });
}

// ===== Escalation Chain =====

export interface EscalationConfig {
    enabled: boolean;
    primary_phone: string;
    primary_email: string;
    primary_slack_user: string;
    secondary_phone: string;
    secondary_email: string;
    phone_delay_min: number;
    auto_fix_delay_min: number;
    quiet_start: string;
    quiet_end: string;
    min_severity: string;
    slack_webhook_url: string;
    twilio_account_sid: string;
    twilio_auth_token: string;
    twilio_from_number: string;
    smtp_host: string;
    smtp_port: string;
    smtp_user: string;
    smtp_password: string;
}

export interface EscalationStep {
    level: number;
    channel: string;
    status: string;
    target: string;
    sent_at: string;
    message: string;
    error_msg?: string;
}

export interface ActiveEscalation {
    id: string;
    incident_id: string;
    incident_title: string;
    severity: string;
    status: string;
    started_at: string;
    acknowledged_at?: string;
    acknowledged_by?: string;
    steps: EscalationStep[];
    current_level: number;
}

export interface EscalationActiveResponse {
    escalations: ActiveEscalation[];
    total: number;
}

export interface EscalationHistoryResponse {
    escalations: ActiveEscalation[];
    total: number;
}

export async function getEscalationConfig(): Promise<EscalationConfig> {
    return request<EscalationConfig>("/api/v1/escalation/config");
}

export async function updateEscalationConfig(config: Partial<EscalationConfig>): Promise<{ status: string; config: EscalationConfig }> {
    return request<{ status: string; config: EscalationConfig }>("/api/v1/escalation/config", {
        method: "PUT",
        body: JSON.stringify(config),
    });
}

export async function triggerEscalation(incidentId: string, title: string, severity: string): Promise<{ status: string; escalation?: ActiveEscalation }> {
    return request<{ status: string; escalation?: ActiveEscalation }>("/api/v1/escalation/trigger", {
        method: "POST",
        body: JSON.stringify({ incident_id: incidentId, title, severity }),
    });
}

export async function acknowledgeEscalation(incidentId: string, by: string): Promise<{ status: string }> {
    return request<{ status: string }>("/api/v1/escalation/acknowledge", {
        method: "POST",
        body: JSON.stringify({ incident_id: incidentId, by }),
    });
}

export async function getActiveEscalations(): Promise<EscalationActiveResponse> {
    return request<EscalationActiveResponse>("/api/v1/escalation/active");
}

export async function getEscalationHistory(): Promise<EscalationHistoryResponse> {
    return request<EscalationHistoryResponse>("/api/v1/escalation/history");
}

// ===== Event Stream (Kafka) =====

export interface StreamEvent {
    type: string;
    source: string;
    title: string;
    detail: string;
    severity: string;
    timestamp: string;
}

export interface EventsResponse {
    events: StreamEvent[];
    total: number;
}

export async function getRecentEvents(): Promise<EventsResponse> {
    return request<EventsResponse>("/api/v1/events/recent");
}

// ===== Cache (Redis) =====

export interface CacheStats {
    connected: boolean;
    total_keys?: number;
    active_sessions?: number;
    memory_used?: string;
    memory_peak?: string;
}

export async function getCacheStats(): Promise<CacheStats> {
    return request<CacheStats>("/api/v1/cache/stats");
}

// ===== Multi-Cluster Fleet =====

export interface ClusterRegistration {
    id: string;
    name: string;
    environment: string;
    region: string;
    provider: string;
    status: string;
    health_score: number;
    workloads: number;
    nodes: number;
    pods: number;
    cpu_percent: number;
    memory_percent: number;
    active_incidents: number;
    last_scan_at: string;
    created_at: string;
    discovery_url?: string;
    monitoring_url?: string;
}

export interface FleetClustersResponse {
    clusters: ClusterRegistration[];
    total: number;
}

export interface FleetSummaryResponse {
    total_clusters: number;
    healthy_clusters: number;
    warning_clusters: number;
    critical_clusters: number;
    fleet_health_score: number;
    total_workloads: number;
    total_nodes: number;
    total_pods: number;
    total_incidents: number;
    ai_confidence: number;
    autonomous_actions: number;
}

export async function getFleetClusters(): Promise<FleetClustersResponse> {
    return request<FleetClustersResponse>("/api/v1/fleet/clusters");
}

export async function getFleetSummary(): Promise<FleetSummaryResponse> {
    return request<FleetSummaryResponse>("/api/v1/fleet/summary");
}

export async function registerCluster(data: {
    name: string;
    environment: string;
    region: string;
    provider: string;
    discovery_url: string;
    monitoring_url: string;
}): Promise<{ status: string; id: string }> {
    return request<{ status: string; id: string }>("/api/v1/fleet/clusters", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function removeCluster(id: string): Promise<{ status: string }> {
    return request<{ status: string }>(`/api/v1/fleet/clusters/${encodeURIComponent(id)}`, {
        method: "DELETE",
    });
}

// ===== Predictive Detection =====

export interface PredictiveResult {
    resource: string;
    predicted_issue: string;
    probability: number;
    time_to_failure: string;
    evidence: string[];
    preventive_action: string;
    trend_direction: string;
    confidence: number;
}

export interface PredictiveModelStats {
    data_points: number;
    tracked_resources: number;
    active_predictions: number;
    collection_interval: string;
    history_window: string;
    algorithms: string[];
}

export interface PredictivePredictionsResponse {
    predictions: PredictiveResult[];
    total: number;
    model_stats: PredictiveModelStats;
}

export interface PredictiveExplainResponse {
    resource: string;
    explanation: string;
    root_cause_hypothesis: string;
    recommended_actions: string[];
    confidence: number;
    model: string;
}

export async function getPredictivePredictions(): Promise<PredictivePredictionsResponse> {
    return request<PredictivePredictionsResponse>("/api/v1/predictive/predictions");
}

export async function getPredictiveStats(): Promise<PredictiveModelStats> {
    return request<PredictiveModelStats>("/api/v1/predictive/stats");
}

export async function explainPrediction(resource: string, predictedIssue: string, evidence: string[]): Promise<PredictiveExplainResponse> {
    return request<PredictiveExplainResponse>("/api/v1/predictive/explain", {
        method: "POST",
        body: JSON.stringify({ resource, predicted_issue: predictedIssue, evidence }),
    });
}

export async function triggerPredictiveCollection(): Promise<{ status: string; data_points: number }> {
    return request<{ status: string; data_points: number }>("/api/v1/predictive/collect", {
        method: "POST",
        body: JSON.stringify({}),
    });
}

// ===== Plugin SDK =====

export interface PluginInfo {
    name: string;
    version: string;
    type: string;
    description: string;
    author: string;
    enabled: boolean;
    detection_count: number;
    last_run: number | null;
    error: string | null;
}

export interface PluginDetection {
    plugin: string;
    title: string;
    severity: string;
    service: string;
    namespace: string;
    evidence: string[];
    recommendation: string;
    detected_at: number;
}

export interface PluginsListResponse {
    plugins: PluginInfo[];
    total: number;
    detectors: number;
    analyzers: number;
    actions: number;
}

export interface PluginDetectionsResponse {
    detections: PluginDetection[];
    total: number;
}

export async function getPlugins(): Promise<PluginsListResponse> {
    return request<PluginsListResponse>("/api/v1/plugins");
}

export async function getPluginDetections(): Promise<PluginDetectionsResponse> {
    return request<PluginDetectionsResponse>("/api/v1/plugins/detections");
}

export async function runPluginDetectors(): Promise<{ status: string; detections: PluginDetection[]; total: number }> {
    return request<{ status: string; detections: PluginDetection[]; total: number }>("/api/v1/plugins/run-detectors", {
        method: "POST",
        body: JSON.stringify({}),
    });
}

export async function installPlugin(code: string, filename: string): Promise<{ status: string; plugins?: string[] }> {
    return request<{ status: string; plugins?: string[] }>("/api/v1/plugins/install", {
        method: "POST",
        body: JSON.stringify({ code, filename }),
    });
}

export async function enablePlugin(name: string): Promise<{ status: string }> {
    return request<{ status: string }>(`/api/v1/plugins/enable/${encodeURIComponent(name)}`, {
        method: "POST",
        body: JSON.stringify({}),
    });
}

export async function disablePlugin(name: string): Promise<{ status: string }> {
    return request<{ status: string }>(`/api/v1/plugins/disable/${encodeURIComponent(name)}`, {
        method: "POST",
        body: JSON.stringify({}),
    });
}

export async function unloadPlugin(name: string): Promise<{ status: string }> {
    return request<{ status: string }>(`/api/v1/plugins/${encodeURIComponent(name)}`, {
        method: "DELETE",
    });
}

// ===== Incident Reports (Auto-Generated) =====

export interface GeneratedReport {
    id: string;
    incident_id: string;
    title: string;
    severity: string;
    duration: string;
    generated_at: string;
    resolved_at: string;
    status: string;
    content?: string;
    sections?: {
        summary: string;
        root_cause: string;
        impact: string;
        actions_taken: number;
        recommendations: string[];
    };
}

export interface ReportsListResponse {
    reports: GeneratedReport[];
    total: number;
}

export async function getGeneratedReports(): Promise<ReportsListResponse> {
    return request<ReportsListResponse>("/api/v1/reports");
}

export async function getReportDetail(id: string): Promise<GeneratedReport> {
    return request<GeneratedReport>(`/api/v1/reports/${encodeURIComponent(id)}`);
}

export async function getReportPdfUrl(id: string): Promise<string> {
    return `/api/proxy/reports/${encodeURIComponent(id)}/pdf`;
}

export async function generateReport(incidentId: string): Promise<{ status: string; report_id: string; title: string }> {
    return request<{ status: string; report_id: string; title: string }>("/api/v1/reports/generate", {
        method: "POST",
        body: JSON.stringify({ incident_id: incidentId }),
    });
}

export async function generateAllReports(): Promise<{ status: string; generated: Array<{ report_id: string; incident_id: string; title: string }>; total: number }> {
    return request<{ status: string; generated: Array<{ report_id: string; incident_id: string; title: string }>; total: number }>("/api/v1/reports/generate-all", {
        method: "POST",
        body: JSON.stringify({}),
    });
}

// ===== Morning Briefing =====

export interface BriefingIncident {
    id: string;
    title: string;
    severity: string;
    status: string;
    service: string;
    root_cause: string;
}

export interface BriefingRemediation {
    action: string;
    target: string;
    status: string;
    message: string;
    dry_run: boolean;
}

export interface BriefingResponse {
    id: string;
    generated_at: string;
    period: string;
    greeting: string;
    summary: string;
    sections: {
        incidents: BriefingIncident[];
        remediations: BriefingRemediation[];
        cluster_health: Record<string, string>;
        guardian: { enabled: boolean; mode: string; runs: number; reports: number; confidence: number };
        recommendations: string[];
    };
    stats: {
        total_incidents: number;
        critical_incidents: number;
        high_incidents: number;
        remediations_executed: number;
        successful_remediations: number;
        failed_remediations: number;
        guardian_active: boolean;
        guardian_runs: number;
    };
    model: string;
}

export interface BriefingHistoryResponse {
    briefings: BriefingResponse[];
    total: number;
}

export async function getLatestBriefing(): Promise<BriefingResponse> {
    return request<BriefingResponse>("/api/v1/briefing/latest");
}

export async function generateBriefing(): Promise<BriefingResponse> {
    return request<BriefingResponse>("/api/v1/briefing/generate", {
        method: "POST",
        body: JSON.stringify({}),
    });
}

export async function getBriefingHistory(): Promise<BriefingHistoryResponse> {
    return request<BriefingHistoryResponse>("/api/v1/briefing/history");
}

// ===== AI Model Management =====

export interface LocalModelInfo {
    id: string;
    name: string;
    size: string;
    category: "small" | "medium" | "large" | "embedding";
    description: string;
    provider: string;
    default?: boolean;
}

export interface CloudProviderInfo {
    id: string;
    name: string;
    models: string[];
    key_env: string;
}

export interface ModelCatalogResponse {
    local_models: LocalModelInfo[];
    cloud_providers: CloudProviderInfo[];
}

export interface InstalledModel {
    id: string;
    size: number;
    size_human: string;
    modified_at: string;
    family: string;
    parameter_size: string;
    quantization: string;
}

export interface InstalledModelsResponse {
    models: InstalledModel[];
    total: number;
}

export interface ActiveModelResponse {
    chat_model: string;
    embedding_model: string;
    endpoint: string;
}

export interface PullStatusResponse {
    model_id: string;
    status: "pulling" | "ready" | "error" | "unknown";
    progress: number;
    error: string | null;
}

export interface CloudKeyStatus {
    id: string;
    name: string;
    has_key: boolean;
    models: string[];
}

export interface CloudKeysResponse {
    providers: CloudKeyStatus[];
}

export async function getModelCatalog(): Promise<ModelCatalogResponse> {
    return request<ModelCatalogResponse>("/api/v1/models/catalog");
}

export async function getInstalledModels(): Promise<InstalledModelsResponse> {
    return request<InstalledModelsResponse>("/api/v1/models/installed");
}

export async function getActiveModel(): Promise<ActiveModelResponse> {
    return request<ActiveModelResponse>("/api/v1/models/active");
}

export async function pullModel(modelId: string): Promise<{ status: string; model_id: string; message?: string }> {
    return request<{ status: string; model_id: string; message?: string }>("/api/v1/models/pull", {
        method: "POST",
        body: JSON.stringify({ model_id: modelId }),
    });
}

export async function getPullStatus(modelId: string): Promise<PullStatusResponse> {
    return request<PullStatusResponse>(`/api/v1/models/pull/status/${encodeURIComponent(modelId)}`);
}

export async function switchModel(modelId: string, modelType: "chat" | "embedding"): Promise<{ status: string; message: string }> {
    return request<{ status: string; message: string }>("/api/v1/models/switch", {
        method: "POST",
        body: JSON.stringify({ model_id: modelId, model_type: modelType }),
    });
}

export async function deleteModel(modelId: string): Promise<{ status: string; model_id: string }> {
    return request<{ status: string; model_id: string }>("/api/v1/models/delete", {
        method: "POST",
        body: JSON.stringify({ model_id: modelId }),
    });
}

// ===== Cloud LLM API Keys (optional BYOK) =====

export async function storeCloudKey(providerId: string, apiKey: string): Promise<{ status: string; message: string }> {
    return request<{ status: string; message: string }>("/api/v1/models/cloud/key", {
        method: "POST",
        body: JSON.stringify({ provider_id: providerId, api_key: apiKey }),
    });
}

export async function getCloudKeys(): Promise<CloudKeysResponse> {
    return request<CloudKeysResponse>("/api/v1/models/cloud/keys");
}

export async function deleteCloudKey(providerId: string): Promise<{ status: string }> {
    return request<{ status: string }>(`/api/v1/models/cloud/key/${encodeURIComponent(providerId)}`, {
        method: "DELETE",
    });
}


