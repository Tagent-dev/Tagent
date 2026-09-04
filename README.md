<p align="center">
  <img src="https://img.shields.io/badge/Tagent-AI%20SRE%20Platform-22c55e?style=for-the-badge&logo=kubernetes&logoColor=white" alt="Tagent" />
</p>

<h1 align="center">Tagent</h1>

<p align="center">
  <strong>AI-Powered Kubernetes Incident Intelligence & Auto-Remediation Platform</strong>
</p>

<p align="center">
  <a href="#installation"><img src="https://img.shields.io/badge/Install-Helm-0f766e?style=flat-square&logo=helm" alt="Helm" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache%202.0-blue?style=flat-square" alt="License" /></a>
  <a href="#local-models-only"><img src="https://img.shields.io/badge/AI-Local%20Models%20Only-22c55e?style=flat-square" alt="Local AI" /></a>
  <img src="https://img.shields.io/badge/Status-Alpha-orange?style=flat-square" alt="Status" />
  <a href="https://github.com/Tagent-dev/Tagent"><img src="https://img.shields.io/github/stars/Tagent-dev/Tagent?style=flat-square&color=22c55e" alt="Stars" /></a>
</p>

<p align="center">
  Tagent watches your Kubernetes clusters, detects incidents, identifies root causes,<br/>
  executes safe fixes, and documents everything — automatically.<br/>
  <strong>Runs entirely on your hardware. No data leaves your cluster.</strong>
</p>

---

## What is Tagent?

Tagent is an open-source AI SRE (Site Reliability Engineer) that lives inside your Kubernetes cluster. It continuously monitors your infrastructure, correlates signals across metrics and events, and takes action when things go wrong.

**The problem:** Engineers spend hours correlating dashboards, logs, and alerts during incidents. Incidents happen at night. The same problems get fixed repeatedly.

**Tagent's solution:**

```
Incident detected → Root cause identified → Safe fix executed → Report generated → Team notified
```

All of this happens automatically, with full transparency and human approval for risky actions.

---

## Features

| Feature | Description |
|---------|-------------|
| **Auto-Detection** | Monitors pods, deployments, nodes, metrics in real-time |
| **AI Root Cause Analysis** | Correlates signals to identify why something broke |
| **Auto-Remediation** | Restarts pods, scales deployments, rolls back — with safety checks |
| **Night Guardian** | Autonomous overnight mode with configurable confidence thresholds |
| **Escalation Chain** | Slack → Email → Phone call → Auto-fix (configurable timing) |
| **Morning Briefing** | AI-generated "here's what happened overnight" summary |
| **Incident Reports** | Auto-generated postmortems with PDF export |
| **Knowledge Base** | Vector-search powered incident memory (pgvector) |
| **Risk Scoring** | Predicts which services are most likely to fail next |
| **Predictive Detection** | ML-based failure prediction before incidents occur |
| **Plugin SDK** | Community-built custom detectors — extend without modifying core |
| **Multi-Cluster** | Monitor multiple K8s clusters from one dashboard |
| **Service Topology** | Visual dependency graph with health indicators |
| **Cost Dashboard** | Infrastructure spend tracking with optimization recommendations |
| **Chaos Testing** | Dry-run failure simulations to validate resilience |
| **HPA/VPA Monitoring** | Track autoscaling status and events |
| **CLI** | `tagent incidents`, `tagent chat`, `tagent risks`, `tagent remediate` |

---

## Local Models Only

Tagent's AI engine runs **entirely on local models**. No OpenAI, no Anthropic, no cloud APIs. Ever.

- **Runtime:** [Ollama](https://ollama.ai)
- **Chat model:** `llama3.1:8b`
- **Embedding model:** `nomic-embed-text`

**Why:** Privacy, cost predictability, air-gapped support, compliance (SOC 2, HIPAA, FedRAMP), zero vendor lock-in.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Ingress (ALB / NGINX)                       │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                       API Gateway (Go/Gin)                        │
│     Auth · Rate Limit (Redis) · Cache · Routing · WebSocket      │
│               Prometheus /metrics · Multi-Cluster                 │
└──┬──────────┬──────────┬──────────┬──────────┬──────────────────┘
   │          │          │          │          │
   ▼          ▼          ▼          ▼          ▼
┌──────┐ ┌────────┐ ┌──────────────────┐ ┌────────┐ ┌────────────┐
│Disco-│ │Monitor-│ │    AI Engine      │ │Remedi- │ │Notification│
│very  │ │  ing   │ │   (Python)        │ │ation   │ │  Service   │
│(Go)  │ │ (Go)   │ │                   │ │ (Go)   │ │   (Go)     │
│      │ │        │ │ • Chat            │ │        │ │            │
│Scan  │ │Detect  │ │ • RCA             │ │Execute │ │ Slack      │
│HPA   │ │Alerts  │ │ • Knowledge Base  │ │Guardian│ │ Email      │
│Logs  │ │Incident│ │ • Risk Scoring    │ │Chaos   │ │ Phone      │
│Cost  │ │        │ │ • Predictive      │ │Reports │ │ Escalation │
│      │ │        │ │ • Plugins         │ │        │ │ Kafka Consumer│
│      │ │        │ │ • Briefing        │ │        │ │            │
│      │ │        │ │ • Reports         │ │        │ │            │
└──┬───┘ └───┬────┘ └────────┬─────────┘ └───┬────┘ └──────┬─────┘
   │         │               │               │              │
   └─────────┴───────────────┼───────────────┴──────────────┘
                             │
   ┌─────────────────────────┼─────────────────────────────────┐
   │  PostgreSQL (pgvector) · Redis · Kafka · Prometheus · Ollama │
   └───────────────────────────────────────────────────────────────┘
```

**All services run as pods in the `tagent` namespace.**

---

## Installation

### Prerequisites

- Kubernetes 1.25+ (minikube, kind, Docker Desktop, EKS, GKE, AKS)
- Helm 3.10+
- `kubectl` configured for your cluster

### Quick Install (from Helm repo)

```bash
helm repo add tagent https://tagent-dev.github.io/Tagent
helm repo update
helm install tagent tagent/tagent --namespace tagent --create-namespace
```

### Install from Source

```bash
git clone https://github.com/Tagent-dev/Tagent.git
cd Tagent
helm install tagent ./helm-charts/tagent --namespace tagent --create-namespace
```

### Access the UI

Pick whichever fits your cluster. The default is **Method 1 (NodePort)**.

**Method 1 — NodePort (default).** The UI is exposed on every node at port `31777`.

```bash
# Get a node IP
kubectl get nodes -o wide
```

Open **http://&lt;NodeIP&gt;:31777**

> Managed clusters (EKS/GKE/AKS) only allow NodePorts in 30000-32767, which is
> why the default is `31777`. If your nodes are **private** (e.g. EKS behind an
> EC2 bastion), the node IP is not reachable from your laptop — use Method 2 or 3.

**Method 2 — LoadBalancer.** A cloud load balancer is provisioned and the UI is
reached via the LB address (not a node/EC2 IP).

```bash
helm install tagent tagent/tagent --namespace tagent --create-namespace \
  --set web.service.type=LoadBalancer

# Get the external address once provisioned
kubectl get svc tagent-web -n tagent
```

Open **http://&lt;EXTERNAL-IP&gt;:7777**

**Method 3 — port-forward.** Works with any service type and needs no chart
change. Run it from a machine that can reach the cluster (e.g. your EC2 bastion):

```bash
kubectl port-forward -n tagent svc/tagent-web 7777:7777 --address 0.0.0.0
```

Open **http://&lt;YOUR-SERVER-IP&gt;:7777** (or **http://localhost:7777** on that machine)

### Pull AI Model (first time)

```bash
kubectl exec -it -n tagent $(kubectl get pods -n tagent -l app=ollama -o name) -- ollama pull llama3.1:8b
kubectl exec -it -n tagent $(kubectl get pods -n tagent -l app=ollama -o name) -- ollama pull nomic-embed-text
```

---

## What Gets Deployed

```
$ kubectl get pods -n tagent

tagent-api-gateway-xxx      1/1   Running
tagent-discovery-xxx        1/1   Running
tagent-monitoring-xxx       1/1   Running
tagent-ai-engine-xxx        1/1   Running
tagent-remediation-xxx      1/1   Running
tagent-notification-xxx     1/1   Running
tagent-ollama-xxx           1/1   Running
tagent-web-xxx              1/1   Running
tagent-postgres-xxx         1/1   Running
tagent-redis-xxx            1/1   Running
tagent-kafka-xxx            1/1   Running
```

---

## CLI

Install the CLI for terminal access:

```bash
# Linux
curl -Lo tagent https://github.com/Tagent-dev/Tagent/releases/latest/download/tagent-linux-amd64
chmod +x tagent && sudo mv tagent /usr/local/bin/

# macOS
curl -Lo tagent https://github.com/Tagent-dev/Tagent/releases/latest/download/tagent-darwin-arm64
chmod +x tagent && sudo mv tagent /usr/local/bin/
```

```bash
$ tagent status           # cluster health
$ tagent incidents        # list active incidents
$ tagent chat 'why is checkout slow?'  # ask AI
$ tagent risks            # service risk scores
$ tagent remediate restart-pod -n prod -t app-xyz --dry-run
$ tagent guardian         # Night Guardian status
```

---

## Configuration

Key settings in `values.yaml`:

```yaml
# Remediation safety mode
remediation:
  mode: "read-only"     # read-only | approval-required | auto

# Night Guardian (autonomous overnight mode)
nightGuardian:
  enabled: false
  confidence: "85"

# Escalation chain
escalation:
  enabled: false
  phoneDelayMin: "3"
  autoFixDelayMin: "10"
  minSeverity: "high"

# Local AI model
ollama:
  model: "llama3.1:8b"
  embeddingModel: "nomic-embed-text"

# Multi-cluster (register additional clusters via API)
# POST /api/v1/fleet/clusters
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| API Gateway | Go + Gin + Redis (rate limit + cache) |
| Discovery, Monitoring, Remediation, Notification | Go |
| AI Engine | Python + FastAPI + Ollama |
| Frontend | Next.js 15 + TypeScript + Tailwind CSS |
| Database | PostgreSQL + pgvector |
| Cache | Redis 7 |
| Event Bus | Apache Kafka |
| Metrics | Prometheus (all services expose /metrics) |
| LLM | Ollama (local, llama3.1:8b) |
| Deployment | Kubernetes + Helm |
| CI/CD | GitHub Actions |
| CLI | Go + Cobra |

---

## Development

```bash
# Start infrastructure
docker compose -f docker-compose.dev.yml up -d

# Frontend
cd frontend/web && npm install && npm run dev

# API Gateway
cd backend/services/api-gateway && go run cmd/server/main.go

# AI Engine
cd backend/services/ai-engine
pip install -r requirements.txt
uvicorn app.main:app --port 8083

# Pull LLM model
docker compose exec ollama ollama pull llama3.1:8b
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [Installation Guide](doc/INSTALL.md) | Step-by-step install (Helm, Kind, EKS, GKE, AKS, local) |
| [Contributing Guide](CONTRIBUTING.md) | Setup, development, PR process, code style |
| [Developer Guide](doc/DEVELOPER_GUIDE.md) | Deep-dive into codebase, adding features, testing |
| [Architecture](doc/ARCHITECTURE.md) | System design, data flow, service responsibilities |
| [API Reference](doc/API_REFERENCE.md) | All 80+ API endpoints |
| [Development Roadmap](doc/DEVELOPMENT_ROADMAP.md) | Full build plan from code to market |
| [AI Requirements](doc/AI_REQUIREMENTS.md) | Local models constraint (hard requirement) |
| [Advanced Features](doc/FEATURES_ADVANCED.md) | Auto-fix, escalation, video briefing spec |
| [Plugin SDK](doc/PLUGIN_SDK.md) | Build custom detectors |
| [Vision](doc/VISION.md) | Original project vision and philosophy |
| [CLI README](cli/README.md) | CLI installation and commands |
| [Security Policy](SECURITY.md) | Vulnerability reporting, security design |
| [Code of Conduct](CODE_OF_CONDUCT.md) | Community behavior standards |

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.

**Quick start for new contributors:**

```bash
git clone https://github.com/Tagent-dev/Tagent.git
cd Tagent
# Pick an issue labeled "good-first-issue"
# Make your changes
# Submit a PR
```

No formal application. Just pick an issue and start coding.

---

## Roadmap

- [x] Core platform (6 microservices)
- [x] AI Chat + RCA + Analysis (Ollama)
- [x] Night Guardian (autonomous remediation)
- [x] Knowledge Base (pgvector embeddings)
- [x] Risk Scoring + Predictive Detection
- [x] Escalation Chain (Slack → Email → Phone)
- [x] Morning Briefing (AI summary)
- [x] Incident Reports (Markdown + PDF)
- [x] Plugin SDK (custom detectors)
- [x] Multi-Cluster support
- [x] CLI tool
- [x] Kafka event streaming
- [x] Redis caching + rate limiting
- [x] Prometheus /metrics on all services
- [ ] JWT + OIDC authentication
- [ ] RBAC enforcement
- [ ] Mobile app
- [ ] AI Video Briefing (local TTS)

---

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

- All AI runs locally — no data leaves your cluster
- Destructive actions always require human approval (unless Night Guardian is enabled)
- All actions are audit-logged
- Helm chart uses non-root containers, read-only filesystem, dropped capabilities

---

## License

[Apache License 2.0](LICENSE)

---

<p align="center">
  <sub>Built for engineers who are tired of being paged at 3 AM.</sub>
</p>
