"""Context builder — fetches REAL cluster data from Discovery Service.

When Discovery Service is running, this fetches live data.
When it's not running, returns an explicit "no data" message (no fake data).
"""

import os

import httpx

DISCOVERY_URL = os.getenv("DISCOVERY_URL", "http://localhost:8081")


async def fetch_cluster_context() -> str:
    """Fetch current cluster state from Discovery Service."""

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            r = await client.get(f"{DISCOVERY_URL}/resources")
            if r.status_code == 200:
                data = r.json()
                return format_live_context(data)
        except Exception:
            pass

    # Discovery Service is not reachable — return explicit no-data message
    return NO_DATA_CONTEXT


def format_live_context(data: dict) -> str:
    """Format live cluster data into a readable context for the LLM."""
    lines = []
    lines.append(f"CLUSTER STATE (live scan at {data.get('scanned_at', 'unknown')}):")
    lines.append("")

    summary = data.get("summary", {})
    lines.append("SUMMARY:")
    lines.append(f"- Nodes: {summary.get('total_nodes', 0)} total, {summary.get('ready_nodes', 0)} Ready")
    lines.append(f"- Pods: {summary.get('total_pods', 0)} total, {summary.get('running_pods', 0)} Running, {summary.get('failed_pods', 0)} Failed/CrashLoop")
    lines.append(f"- Deployments: {summary.get('total_deployments', 0)}")
    lines.append(f"- Services: {summary.get('total_services', 0)}")
    lines.append(f"- Namespaces: {', '.join(data.get('namespaces', []))}")
    lines.append("")

    # Nodes
    nodes = data.get("nodes", [])
    if nodes:
        lines.append("NODES:")
        for n in nodes:
            lines.append(f"- {n['name']}: {n['status']}, role={n['role']}, CPU capacity={n['cpu_capacity']}, Memory capacity={n['memory_capacity']}, Pods={n.get('pod_count', '?')}, IP={n.get('internal_ip', '?')}")
        lines.append("")

    # Pods (show failing ones + first 30 running)
    pods = data.get("pods", [])
    failing = [p for p in pods if p["status"] not in ("Running", "Succeeded", "Completed")]
    running = [p for p in pods if p["status"] == "Running"]

    if failing:
        lines.append("FAILING PODS:")
        for p in failing:
            lines.append(f"- {p['namespace']}/{p['name']}: status={p['status']}, restarts={p['restarts']}, node={p['node']}, cpu_req={p.get('cpu_request','?')}, mem_req={p.get('memory_request','?')}")
        lines.append("")

    if running:
        lines.append(f"RUNNING PODS ({len(running)} total, showing first 30):")
        for p in running[:30]:
            lines.append(f"- {p['namespace']}/{p['name']}: restarts={p['restarts']}, node={p['node']}, cpu_req={p.get('cpu_request','?')}, mem_req={p.get('memory_request','?')}")
        lines.append("")

    # Deployments
    deps = data.get("deployments", [])
    if deps:
        lines.append("DEPLOYMENTS:")
        for d in deps:
            status = "healthy" if d["ready"] == d["replicas"] else "DEGRADED"
            lines.append(f"- {d['namespace']}/{d['name']}: {d['ready']}/{d['replicas']} ready ({status})")
        lines.append("")

    return "\n".join(lines)


NO_DATA_CONTEXT = """
CLUSTER STATE: Discovery Service is not connected.
No real cluster data is available. I cannot answer questions about specific pods, nodes, or services without live data.
Please ensure the Discovery Service is running and accessible.
"""
