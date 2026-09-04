# Tagent — Complete Development & Deployment Roadmap

## From First Line of Code to Market Release

This is the single source of truth for building, deploying, and releasing Tagent. Follow it sequentially. Stop only when each phase passes its acceptance criteria.

---

## Table of Contents

1. Project Summary
2. Technology Decisions
3. Development Phases Overview
4. Phase 1 — Foundation & Infrastructure
5. Phase 2 — Core Platform Services
6. Phase 3 — AI Intelligence Layer
7. Phase 4 — Frontend Dashboard
8. Phase 5 — Integration & Testing
9. Phase 6 — Deployment & DevOps Pipeline
10. Phase 7 — Security & Hardening
11. Phase 8 — Beta Release
12. Phase 9 — Production & Market Release
13. Phase 10 — Post-Launch & Growth
14. Service Port Map
15. API Contract Summary
16. Database Schema Plan
17. Deployment Architecture
18. Release Checklist
19. Timeline & Effort Estimate
20. Stop Criteria (When to declare DONE)

---

## 1. Project Summary

**Name:** Tagent
**Type:** Open-source, Kubernetes-native AI SRE Platform
**License:** MIT (core), Commercial (enterprise features)
**Repository structure:** Monorepo

**One-line product promise:**
Tagent watches your Kubernetes infrastructure, detects incidents, identifies root causes, executes safe fixes, and writes the incident report for you.

**Why Tagent exists:**
- Engineers waste hours correlating logs, metrics, and traces during incidents
- Incidents happen at night, on weekends, during launches
- The same problems get fixed manually over and over
- Postmortems are written late, incompletely, or never
- Small teams cannot afford dedicated SREs

**Differentiators:**
- Not just monitoring — it understands, correlates, and acts
- Explainable AI — every decision is transparent and auditable
- Safety-first — destructive actions require human approval
- Incident memory — learns patterns from past incidents
- Full lifecycle — detect → analyze → fix → document → notify

---

## 2. Technology Decisions

These are final. Do not change mid-project unless there is a hard blocker.

| Component | Technology | Reason |
|-----------|-----------|--------|
| API Gateway | Go + Gin | High performance, low memory, K8s ecosystem |
| Discovery Service | Go + client-go | Native Kubernetes interaction |
| Monitoring Service | Go | Prometheus client libraries are Go-first |
| AI Engine | Python 3.11 + FastAPI | Best LLM/ML libraries |
| Remediation Service | Go | Safety-critical, direct K8s API |
| Notification Service | Go | Simple message dispatch |
| Documentation Service | Go | Markdown templating, fast |
| Frontend | Next.js 14 + TypeScript | SSR, App Router, React 19 |
| Styling | Tailwind CSS v4 | Utility-first, fast iteration |
| Charts | Recharts | React-native dashboards |
| Real-time | WebSocket (gorilla/websocket) | Live updates |
| Database | PostgreSQL 15 | JSONB, reliability |
| Cache | Redis 7 | Sessions, pub/sub, rate limit |
| Queue | Kafka | Telemetry stream ingestion |
| Metrics | Prometheus | K8s standard |
| Logs | Loki | K8s-native log aggregation |
| Traces | OpenTelemetry + Jaeger | Distributed tracing |
| Deployment | Kubernetes + Helm | Target platform IS K8s |
| CI/CD | GitHub Actions | Free, reliable |
| Auth | JWT + OIDC | Stateless, standard |
| Container Registry | GHCR (ghcr.io) | Free for public repos |
| LLM Runtime | **Ollama (local only)** | **Privacy, cost, air-gapped support** — no cloud APIs |
| Default chat model | `llama3.1:8b` | Strong reasoning, runs on modest hardware |
| Default embedding model | `nomic-embed-text` | Lightweight, fast, good quality |
| Secrets (MVP) | Kubernetes Secrets | Built-in |
| Secrets (Enterprise) | HashiCorp Vault | Production-grade |

---

## 3. Development Phases Overview

```
Phase 1: Foundation          → Repo, CI, Docker, local dev environment
Phase 2: Core Services       → API Gateway, Discovery, Monitoring, Remediation, Notification, Documentation
Phase 3: AI Layer            → AI Engine, RCA, NLP, correlation, knowledge graph
Phase 4: Frontend            → Dashboard, real-time updates, AI chat UI
Phase 5: Integration Testing → E2E flows, chaos testing, load testing
Phase 6: Deployment Pipeline → Helm chart, CI/CD, container builds, releases
Phase 7: Security            → Auth, RBAC, audit logs, vulnerability scans
Phase 8: Beta Release        → Public beta, community onboarding
Phase 9: Market Release      → v1.0, marketing site, launch
Phase 10: Growth             → Enterprise, multi-cloud, plugins, mobile
```

**Total estimated effort:** 6-9 months for a small team (2-3 engineers) to reach v1.0 GA.

---

## 4. Phase 1 — Foundation & Infrastructure

**Goal:** Working local dev environment where every service can be built, started, and tested.

**Duration:** 1-2 weeks

### 4.1 Tasks

- [x] 1.1 Initialize monorepo structure (backend/, deployment/, helm-charts/, scripts/, doc/)
- [x] 1.2 .gitignore, .dockerignore, .env.example
- [x] 1.3 docker-compose.dev.yml (Postgres, Redis, Prometheus, Kafka)
- [ ] 1.4 Dockerfiles for each service (only API Gateway + AI Engine done; missing discovery, monitoring, remediation, notification, documentation, web)
- [ ] 1.5 GitHub Actions CI pipeline (lint, test, build)
- [ ] 1.6 Makefile with common commands (build, test, run, lint, fmt)
- [ ] 1.7 Go workspace (go.work) for shared modules
- [ ] 1.8 Shared Go packages: logger, config, errors, k8s client
- [x] 1.9 Python requirements.txt for AI Engine
- [ ] 1.10 Dev scripts (setup.sh + build.sh done; missing test.sh, run.sh)
- [ ] 1.11 CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md
- [ ] 1.12 LICENSE (MIT)
- [ ] 1.13 Helm chart skeleton (Chart.yaml + values.yaml done; missing templates/)
- [ ] 1.14 Pre-commit hooks (gofmt, eslint, ruff)

**Phase 1 progress: 4 of 14 fully done → ~30% complete.**

### 4.2 Acceptance Criteria

- `docker compose -f docker-compose.dev.yml up -d` brings up Postgres, Redis, Prometheus, Kafka
- `make build` builds all backend services
- `go run cmd/server/main.go` from `backend/services/api-gateway/` starts API Gateway on :8080
- `curl http://localhost:8080/health` returns 200 with `{"status":"healthy"}`
- CI pipeline runs lint + tests on every PR
- New developer can clone and run the project in under 10 minutes

### 4.3 Files to Create

```
Makefile
go.work
backend/shared/pkg/logger/logger.go
backend/shared/pkg/config/config.go
backend/shared/pkg/errors/errors.go
backend/shared/pkg/k8s/client.go
.github/workflows/ci.yml
.github/workflows/release.yml
.github/workflows/security.yml
.github/dependabot.yml
CONTRIBUTING.md
CODE_OF_CONDUCT.md
SECURITY.md
LICENSE
```

---

## 5. Phase 2 — Core Platform Services

**Goal:** All backend services run, communicate, and perform their core jobs.

**Duration:** 4-6 weeks

### 5.1 API Gateway (Week 1-2)

The single entry point for UI, CLI, bots, and external clients.

**Build order:**
1. Health and readiness endpoints (DONE — skeleton exists)
2. Request ID middleware (DONE)
3. CORS middleware (DONE)
4. JWT authentication middleware
5. Rate limiting middleware (Redis-backed)
6. Service-to-service routing layer (proxies to internal services)
7. WebSocket hub for real-time updates
8. Audit log middleware (every authenticated request logged)
9. OpenAPI/Swagger documentation
10. Prometheus `/metrics` endpoint

**Acceptance:**
- `/health`, `/ready`, `/metrics` work
- Authenticated endpoint returns 401 without token, 200 with valid JWT
- WebSocket connection upgrades on `/ws` and stays alive
- Rate limiting blocks 101st request in a minute
- `swagger.json` served at `/api/v1/openapi.json`

### 5.2 Discovery Service (Week 2-3)

Scans Kubernetes clusters and builds an inventory.

**Build order:**
1. Initialize K8s client (in-cluster + kubeconfig fallback)
2. Watcher for Pods, Deployments, Services, Nodes, Namespaces
3. Watcher for Events, ConfigMaps, Secrets metadata, Ingress
4. PostgreSQL persistence layer
5. Topology graph builder (service → pod → node relationships)
6. Internal HTTP API for API Gateway to consume
7. Resource diff detection (track changes over time)
8. Kafka producer for change events

**Acceptance:**
- On startup, lists all resources in cluster within 30s
- Detects new pod within 2s of creation
- `GET /clusters/{id}/topology` returns dependency graph
- Persists state across restarts
- Publishes change events to Kafka topic `tagent.discovery.events`

### 5.3 Monitoring Service (Week 3-4)

Collects and processes operational signals.

**Build order:**
1. Prometheus query client
2. Loki log query client
3. OpenTelemetry trace ingestion endpoint
4. Threshold-based detection rules engine
5. Anomaly buffering and deduplication
6. Kafka producer for `tagent.monitoring.signals`
7. Health rollup (cluster, namespace, service, pod levels)
8. Internal API for incident timeline retrieval

**MVP signals:**
- CPU / memory usage per pod
- Pod restart count
- Pod status (Ready, CrashLoopBackOff, Pending, etc.)
- Node Ready/NotReady
- HTTP request latency (p50, p95, p99)
- HTTP error rate (4xx, 5xx)

**Acceptance:**
- Pulls metrics from Prometheus every 15s
- Detects pod CrashLoopBackOff within 30s
- Stores last 7 days of signal history (rolling)
- Publishes detected anomalies to Kafka

### 5.4 Remediation Service (Week 4-5)

Executes safe fixes against the cluster.

**Build order:**
1. K8s client with scoped RBAC
2. Action library: restart pod, scale deployment, rollback, delete pod, cordon/drain node
3. Dry-run mode for every action
4. Pre-execution safety check (resource exists, permitted, not in protected namespace)
5. Approval queue (Postgres-backed)
6. Audit log writer
7. Post-execution verification (resource healthy after action)
8. Rollback capability (every action has reverse)
9. Internal API for action submission and approval
10. Kafka consumer for AI-suggested actions

**Safety policy (hardcoded):**
- Default mode: read-only
- Destructive actions ALWAYS require human approval
- Production namespaces (configurable list) require admin approval
- Any failed verification triggers automatic rollback attempt
- Every action: who, what, when, why, result — logged forever

**Acceptance:**
- Restart pod via API succeeds and pod becomes Ready within 60s
- Dry-run shows the kubectl-equivalent command without executing
- Approval queue blocks unapproved destructive actions
- Audit log entry created for every action attempt (success or failure)

### 5.5 Notification Service (Week 5)

Delivers alerts to configured channels.

**Build order:**
1. Slack webhook integration
2. SMTP email integration
3. Channel routing rules (severity → channel)
4. Template engine for notification content
5. Deduplication (don't spam same alert 100 times)
6. Kafka consumer for `tagent.incidents.created`
7. Internal API for manual notification dispatch
8. Delivery status tracking

**Channels (MVP):** Slack, Email
**Channels (later):** Teams, PagerDuty, Discord, SMS, WhatsApp

**Acceptance:**
- New incident triggers Slack message within 5s
- Email delivered with incident summary, severity, link
- Duplicate incidents within 5min collapsed into one notification
- Failed delivery retried with exponential backoff (3 attempts)

### 5.6 Documentation Service (Week 5-6)

Generates incident reports and stores them.

**Build order:**
1. Markdown template engine
2. Incident data aggregator (pulls from monitoring, remediation, AI)
3. PostgreSQL storage for reports
4. Internal API for report retrieval
5. Export to PDF (later)
6. Knowledge base linking (similar incidents)

**Report sections (MVP):**
- Title, ID, severity, duration
- Impact summary
- Timeline (events, actions)
- Root cause
- Actions taken
- Verification result
- Prevention recommendations

**Acceptance:**
- Auto-generated report within 30s of incident resolution
- Report stored, retrievable via `GET /api/v1/reports/{id}`
- Markdown rendered correctly in UI

---

## 6. Phase 3 — AI Intelligence Layer

**Goal:** AI Engine analyzes incidents, identifies root causes, and powers natural language interaction.

**Duration:** 4-6 weeks

### 6.1 LLM Provider Abstraction (Week 1) — LOCAL MODELS ONLY

**HARD CONSTRAINT:** No cloud LLM APIs. See `doc/AI_REQUIREMENTS.md`.

**Build:**
- Provider interface (chat, streaming, embeddings, health)
- Ollama implementation (default — `llama3.1:8b` for chat, `nomic-embed-text` for embeddings)
- llama.cpp implementation (alternative for direct GGUF use)
- vLLM implementation (alternative for GPU-accelerated serving)
- Configuration-driven selection via `OLLAMA_ENDPOINT`, `OLLAMA_MODEL`
- Token usage / latency telemetry (no cost tracking — local is free)
- **Forbidden:** any `import openai`, `import anthropic`, or any cloud SDK

### 6.2 Natural Language Query (Week 1-2)

Engineers ask questions about their cluster.

**Build:**
- Intent classifier (read query, action request, question)
- Entity extractor (namespace, deployment, pod, service, action)
- Query → API call mapper
- Response formatter (human-readable + structured data)
- Conversation context (multi-turn dialogue)

**Example queries to support:**
- "How many pods are running in production?"
- "Show me failing deployments this week"
- "Why is checkout slow?"
- "Restart the failed payment pod" (requires approval)
- "What changed before the incident at 2am?"

### 6.3 Root Cause Analysis Engine (Week 2-4)

The intelligence core.

**Build:**
- Telemetry correlation engine (logs + metrics + events + traces in time window)
- Dependency graph traversal
- Pattern matching against incident memory
- Confidence scoring per hypothesis
- Evidence collection (which logs, which metrics support the conclusion)
- LLM-based explanation generation
- Multiple hypothesis ranking

**RCA categories to detect:**
- Memory leak / OOMKilled
- CPU throttling
- Network failure / DNS / connection refused
- Deployment regression (correlate with recent deploys)
- Database connection pool exhaustion
- Disk pressure / volume issues
- Certificate expiration
- Configuration drift
- Resource quota exhaustion

**Acceptance:**
- Given a synthetic CrashLoopBackOff incident, RCA returns root cause with >80% confidence in <30s
- Each conclusion cites specific evidence (log lines, metric values)
- Explanations are clear and actionable

### 6.4 Blast Radius Analysis (Week 4)

**Build:**
- Service dependency traversal (from Discovery topology)
- Affected service enumeration
- User impact estimation (request volume × error rate)
- Cascading failure prediction
- Severity calculation

### 6.5 Incident Correlation Engine (Week 4-5)

Groups related signals into single incidents.

**Build:**
- Time-window correlation (events within 5 min)
- Service-relationship correlation (upstream/downstream)
- Pattern correlation (similar fingerprints)
- Incident deduplication
- Auto-merge of duplicate incidents

### 6.6 Incident Memory / Knowledge Graph (Week 5-6)

**Build:**
- Vector embedding of past incidents (using embeddings provider)
- Similar-incident retrieval (cosine similarity)
- Resolution effectiveness tracking
- Pattern learning from resolved incidents
- Recommendation engine (here's what worked last time)

**Storage:** PostgreSQL with pgvector extension

### 6.7 Decision Engine (Week 6)

Decides what action to recommend or auto-execute.

**Build:**
- Policy engine (read YAML policies from ConfigMap)
- Confidence threshold checks
- Historical success rate lookup
- Safe action sequencer
- Human-escalation triggers
- Night Guardian mode (autonomous low-risk actions only)

**Acceptance:**
- High-confidence (>0.9) low-risk action: auto-execute with notification
- Medium-confidence: suggest with approval queue
- Low-confidence: surface evidence, ask human
- Destructive action: ALWAYS approval, regardless of confidence

---

## 7. Phase 4 — Frontend Dashboard

**Goal:** Mission-control style dashboard. Not a marketing page.

**Duration:** 4-5 weeks

### 7.1 Setup (Week 1)

**Build:**
- Initialize Next.js 14 with App Router in `frontend/web/`
- Configure Tailwind CSS v4
- Add shadcn/ui (only the components actually needed)
- TanStack Query for server state
- Zustand for client state
- WebSocket client wrapper
- API client (typed, auto-generated from OpenAPI)
- Theme: dark by default, terminal aesthetic

### 7.2 Layout & Navigation (Week 1)

**Pages structure:**
```
/                           Dashboard overview
/clusters                   Cluster list
/clusters/:id               Cluster detail
/clusters/:id/topology      Topology graph
/incidents                  Incident list
/incidents/:id              Incident detail
/metrics                    Metrics explorer
/logs                       Log search
/ai                         AI chat assistant
/reports                    Incident reports
/remediation                Remediation history & approval queue
/settings                   Integrations, RBAC, policies
```

### 7.3 Dashboard Page (Week 2)

**Components:**
- Cluster health summary (red/yellow/green)
- Active incidents card
- Resource counts (pods, services, deployments, nodes)
- Recent remediation actions
- CPU/memory utilization charts
- AI Assistant quick chat
- Last 24h incident timeline

### 7.4 Incident Detail Page (Week 2-3)

**Components:**
- Severity badge, status, duration
- Timeline (events, signals, actions)
- Root cause card with confidence
- Evidence panel (logs, metrics, traces)
- Blast radius visualization (affected services graph)
- Suggested remediation with Approve/Reject buttons
- Auto-generated report preview
- Similar incidents sidebar

### 7.5 AI Chat Page (Week 3)

**Components:**
- Conversation thread
- Streaming responses
- Suggested prompts
- Inline action confirmation modals
- Context display (which cluster, which namespace)
- History sidebar

### 7.6 Topology Graph (Week 3-4)

**Components:**
- Force-directed graph (services + dependencies)
- Node coloring by health
- Edge styling by traffic volume
- Click node → service detail panel
- Filter by namespace, label, status

**Library:** react-flow or cytoscape.js

### 7.7 Metrics & Logs (Week 4)

**Components:**
- Time range selector
- Multi-metric chart panel
- Log search with structured filters
- Saved queries
- Live tail mode

### 7.8 Settings (Week 4-5)

**Components:**
- Integrations (Slack webhook, SMTP, OIDC)
- RBAC (users, roles, permissions)
- Remediation policies editor (YAML editor with schema)
- Audit log viewer
- Cluster connection management

### 7.9 Acceptance

- Dashboard loads in <2s on first paint
- Real-time updates work (incident appears without refresh)
- Mobile responsive (can read incident details on phone)
- Accessibility: keyboard navigation, ARIA labels, screen reader friendly
- Works offline for cached data (PWA-ready)

---

## 8. Phase 5 — Integration & Testing

**Goal:** Prove the platform works end-to-end under realistic conditions.

**Duration:** 2-3 weeks

### 8.1 Test Pyramid

**Unit tests (per service):**
- Go: `testing` + `testify`, target 70% coverage
- Python: `pytest`, target 70% coverage
- TypeScript: `vitest`, target 60% coverage

**Integration tests:**
- Service-to-service contracts
- Database operations
- Kafka producer/consumer
- K8s API mocks

**End-to-end tests:**
- Playwright for frontend flows
- Full incident lifecycle in test K8s cluster (kind)

### 8.2 E2E Scenarios

| # | Scenario | Expected Result |
|---|----------|----------------|
| 1 | Install via Helm | All pods Ready in 2 min |
| 2 | UI loads, shows cluster resources | Dashboard renders, lists pods |
| 3 | Pod CrashLoopBackOff occurs | Incident detected within 30s |
| 4 | AI generates RCA | Root cause shown with confidence |
| 5 | User approves restart | Pod restarts, becomes Ready |
| 6 | Incident report generated | Markdown report stored, viewable |
| 7 | Slack notification sent | Message arrives in webhook |
| 8 | AI chat answers query | "How many pods?" → correct count |
| 9 | Audit log records all actions | Every step logged |

### 8.3 Load Testing

**Tools:** k6, vegeta

**Targets:**
- API Gateway: 1000 RPS sustained, p99 <200ms
- Discovery: handle cluster with 10,000 pods
- Monitoring: ingest 10,000 signals/sec
- AI Engine: 100 concurrent chat requests

### 8.4 Chaos Testing

**Tool:** Chaos Mesh

**Scenarios:**
- Kill API Gateway pod — system recovers
- Network partition between services — graceful degradation
- Database loss — services degrade gracefully, recover on reconnect
- Kafka broker loss — telemetry buffered

### 8.5 Acceptance

- All E2E scenarios pass in CI
- Load test targets met
- Chaos tests show graceful degradation
- No P0/P1 bugs open

---

## 9. Phase 6 — Deployment & DevOps Pipeline

**Goal:** One command to install Tagent. Automated, reproducible, signed releases.

**Duration:** 2-3 weeks

### 9.1 Container Builds

**Build:**
- Multi-stage Dockerfiles for each service
- Distroless base images (security)
- Multi-arch builds (amd64, arm64)
- Image signing with cosign
- SBOM generation per image
- CVE scanning (Trivy) in CI, fail on critical

**Registry:** `ghcr.io/tagent-ai/<service>:<version>`

### 9.2 Helm Chart

**Build:**
- Templates for all services (deployment, service, configmap, secret)
- ServiceAccount + RBAC (least privilege)
- Ingress template (optional, configurable)
- HPA template (optional)
- ServiceMonitor for Prometheus Operator
- NetworkPolicies (zero-trust by default)
- PodSecurityContext (non-root, read-only fs, no privilege escalation)
- values.yaml, values-development.yaml, values-production.yaml
- Chart linting in CI (helm lint, kubeconform)
- Chart testing (helm test)
- Custom Resource Definitions for policies

**Distribution:**
- Chart repository at `https://tagent-ai.github.io/charts`
- Published via GitHub Pages from `gh-pages` branch
- Signed with `cosign` and verifiable

### 9.3 Release Pipeline

**GitHub Actions workflows:**

```
ci.yml          → On every PR: lint, test, build
security.yml    → Daily: CVE scan, secret scan, SBOM diff
release.yml     → On tag v*.*.*: build images, publish chart, create GH release
docs.yml        → On main push: deploy docs site
```

**Release process:**
1. Create release branch `release/v0.X.0`
2. Update CHANGELOG.md
3. Bump versions (Chart.yaml, package.json, all go.mod tags)
4. Tag `v0.X.0`
5. CI builds and pushes images, chart, release notes
6. Smoke test against staging cluster
7. Promote to stable channel

### 9.4 Documentation Site

**Build:**
- Static site with Docusaurus or VitePress
- Hosted at `https://docs.tagent.io` (GitHub Pages or Vercel)
- Sections: Getting Started, Installation, Configuration, API Reference, Tutorials, Architecture
- Versioned docs (matches chart versions)

### 9.5 Acceptance

- `helm install tagent tagent/tagent` works on a fresh cluster
- Images are signed and verifiable
- Documentation site live with full quickstart
- Each release has changelog, signed binaries, signed images, signed chart

---

## 10. Phase 7 — Security & Hardening

**Goal:** Production-grade security posture. No P0 vulnerabilities.

**Duration:** 2-3 weeks

### 10.1 Authentication & Authorization

**Build:**
- JWT-based auth with rotating secrets
- OIDC provider integration (Auth0, Okta, Keycloak, GitHub)
- Three roles: Viewer, Operator, Admin
- Per-cluster role assignment
- Service account tokens for CLI/automation
- Session management with Redis

### 10.2 Kubernetes RBAC

**Tagent's own permissions in cluster:**
- Default: read-only across all namespaces
- Operator role: scoped write permissions (specific verbs on specific resources)
- Admin role: broader write but never `delete namespaces` or `cluster-admin`
- Configurable namespace allowlist/denylist

### 10.3 Audit Logging

**Build:**
- Every API call logged (who, when, what, result)
- Every remediation action logged (immutable, tamper-evident)
- Every AI decision logged (input, output, confidence)
- Logs streamed to external SIEM (Splunk, Datadog) optionally
- Retention: 90 days by default, configurable

### 10.4 Secrets Management

**MVP:** Kubernetes Secrets with encryption at rest enabled
**Enterprise:** HashiCorp Vault integration
**Forbidden:** Secrets in environment variables, ConfigMaps, or git

### 10.5 Network Security

**Build:**
- NetworkPolicies between services (default deny)
- TLS for all inter-service communication
- Ingress with TLS termination
- mTLS option for high-security deployments

### 10.6 Vulnerability Management

**Build:**
- Trivy scans on every image build
- Dependabot for dependency updates
- govulncheck in Go CI
- pip-audit in Python CI
- npm audit in Node CI
- Quarterly penetration test (after launch)

### 10.7 AI Safety

**Hardcoded rules:**
- AI never deletes namespaces
- AI never modifies production database
- AI never rotates secrets
- AI never replaces nodes
- AI suggestions for destructive operations require explicit approval
- Every AI-suggested action shows full kubectl-equivalent before execution

### 10.8 Acceptance

- Penetration test report shows no critical/high findings
- All images pass CVE scan with zero critical
- Audit log captures 100% of mutating operations
- OIDC login works with Auth0/Okta/GitHub
- RBAC enforced (viewer cannot trigger remediation)

---

## 11. Phase 8 — Beta Release

**Goal:** Public beta with real users. Get feedback before v1.0.

**Duration:** 4-6 weeks

### 11.1 Pre-Beta

**Build:**
- Public GitHub repository (open source)
- Public website (`tagent.io` or similar)
- Public Helm chart repo
- Public Docker images on GHCR
- Discord/Slack community
- Beta signup form

### 11.2 Beta Program

**Targets:**
- 50-100 beta users
- 5-10 design partners (deeper feedback, weekly calls)
- Mix of: solo devs, small teams, mid-size companies

**Feedback channels:**
- GitHub Issues (bugs, features)
- Discord (community chat)
- Monthly survey
- Anonymous telemetry (opt-in)

### 11.3 Beta Iteration

**Cadence:** weekly releases (v0.x.y)

**Focus:**
- Fix bugs
- Improve onboarding
- Polish UI based on feedback
- Document common questions
- Add most-requested integrations

### 11.4 Beta Exit Criteria

Move to v1.0 GA when:
- 100+ active beta installs
- <5 P0/P1 bugs open at any time
- Documentation complete
- Performance targets met
- Security review passed

---

## 12. Phase 9 — Production & Market Release

**Goal:** v1.0 GA. Tagent is officially a product.

**Duration:** 2-4 weeks (preparation), then ongoing

### 12.1 Pre-Launch Checklist

- [ ] All v1.0 features stable
- [ ] Documentation complete and reviewed
- [ ] Security audit passed
- [ ] Performance benchmarks documented
- [ ] Marketing site live
- [ ] Pricing page (if commercial)
- [ ] Support channels ready (email, Discord, GitHub)
- [ ] Demo video recorded
- [ ] Sample dashboards / screenshots
- [ ] Press kit prepared
- [ ] Launch blog post drafted
- [ ] Twitter/LinkedIn announcement prepared
- [ ] Hacker News, Reddit /r/kubernetes posts ready
- [ ] Product Hunt submission scheduled

### 12.2 Marketing Site

**Pages:**
- Homepage (problem, solution, demo)
- Features
- Architecture
- Pricing (if commercial)
- Documentation link
- Blog
- About / Team
- Contact
- Status page

**Tech:** Next.js, deployed to Vercel or Cloudflare Pages
**Domain:** `tagent.io` (or `tagent.dev`, `tagent.ai`, etc.)

### 12.3 Pricing & Business Model

**Open Source (Free, MIT):**
- Single-cluster monitoring
- Basic dashboard
- Basic remediation
- Basic AI assistant (BYO LLM key)
- Community support

**Cloud / SaaS (Paid):**
- Hosted Tagent (no self-install needed)
- Managed AI (no LLM key needed)
- Multi-cluster
- Email + chat support
- $X/month per cluster, $Y/month per user

**Enterprise (Sales):**
- Self-hosted with enterprise features
- Multi-cloud, multi-cluster
- SSO/SAML
- Compliance reports (SOC 2, HIPAA-ready)
- Advanced RBAC
- Priority support, SLA
- Custom integrations
- Annual contract

### 12.4 Launch Day

**Morning (UTC):**
- Tag v1.0.0
- Publish chart, images, release notes
- Update marketing site to "Available now"
- Launch blog post live
- Tweet thread
- LinkedIn post
- Submit to Hacker News
- Post to /r/kubernetes, /r/devops, /r/sre
- Post to dev.to, Medium

**Day 1-7:**
- Respond to every comment, issue, question
- Monitor analytics, error rates
- Hotfix any critical bugs immediately
- Daily team standup

### 12.5 Post-Launch Metrics to Track

**Acquisition:**
- GitHub stars
- Helm chart downloads
- Docker pulls
- Website visits
- Signup conversions

**Activation:**
- Successful installs (telemetry)
- Time-to-first-incident-detection
- AI chat first-message rate

**Retention:**
- Weekly active clusters
- 30-day retention
- Churn rate

**Revenue (if commercial):**
- MRR / ARR
- Customer count
- Average contract value
- LTV / CAC

---

## 13. Phase 10 — Post-Launch & Growth

**Goal:** Sustainable growth, community, revenue.

**Duration:** Ongoing

### 13.1 Roadmap Themes (Year 1 post-launch)

**Q1 after GA:**
- Multi-cluster support
- Advanced AI agents (specialized: networking, storage, security)
- Cost optimization recommendations
- Service risk scoring

**Q2:**
- Multi-cloud (AWS, GCP, Azure)
- Predictive incident detection
- Plugin SDK
- Mobile app (iOS + Android)

**Q3:**
- Voice interface
- AI video incident explanations
- Marketplace for community plugins
- Compliance reporting (SOC 2, HIPAA, ISO)

**Q4:**
- Self-learning remediation optimization
- Infrastructure digital twin
- Advanced multi-agent orchestration
- Enterprise case studies

### 13.2 Community Building

- Weekly office hours (live stream)
- Monthly community call
- Contributor program (rewards, swag)
- Documentation contributions encouraged
- Annual conference: TagentCon (long-term)
- Speaking at: KubeCon, SREcon, HashiConf

### 13.3 Sustainability

**Revenue strategy:**
- Open source = top of funnel
- Cloud SaaS = self-serve revenue
- Enterprise = high-touch sales

**Funding milestones:**
- 1000 GitHub stars → consider seed round
- 10000 stars + 5 enterprise customers → Series A
- $1M ARR → growth round

---

## 14. Service Port Map

| Service | Port | Protocol |
|---------|------|----------|
| API Gateway | 8080 | HTTP / WebSocket |
| Discovery | 8081 | HTTP (internal) |
| Monitoring | 8082 | HTTP (internal) |
| AI Engine | 8083 | HTTP (internal) |
| Remediation | 8084 | HTTP (internal) |
| Notification | 8085 | HTTP (internal) |
| Documentation | 8086 | HTTP (internal) |
| Web (frontend) | 3000 | HTTP |
| PostgreSQL | 5432 | TCP |
| Redis | 6379 | TCP |
| Prometheus | 9090 | HTTP |
| Kafka | 9092 | TCP |
| Loki | 3100 | HTTP |

---

## 15. API Contract Summary

**Public API (via API Gateway, prefix `/api/v1`):**

```
GET    /health
GET    /ready
GET    /metrics

POST   /auth/login
POST   /auth/refresh
POST   /auth/logout

GET    /clusters
GET    /clusters/:id
POST   /clusters/scan
GET    /clusters/:id/resources
GET    /clusters/:id/topology

GET    /incidents
GET    /incidents/:id
GET    /incidents/:id/timeline
GET    /incidents/:id/report

POST   /ai/chat
POST   /ai/analyze
POST   /ai/rca

GET    /remediation/queue
POST   /remediation/execute
POST   /remediation/:id/approve
POST   /remediation/:id/reject
GET    /remediation/history

GET    /reports
GET    /reports/:id

GET    /settings/integrations
PUT    /settings/integrations/:type
GET    /settings/users
GET    /settings/policies

WS     /ws  (real-time updates)
```

**Internal APIs:** Each service exposes its own internal endpoints, only reachable from inside the cluster via NetworkPolicy.

---

## 16. Database Schema Plan

**PostgreSQL — main store**

```sql
-- Users & Auth
users (id, email, name, role, oidc_subject, created_at)
sessions (id, user_id, expires_at, ip_address)
api_keys (id, user_id, hashed_key, scopes, expires_at)

-- Clusters
clusters (id, name, kubeconfig_secret_ref, status, created_at)

-- Resources (snapshot from Discovery)
resources (id, cluster_id, kind, namespace, name, spec_jsonb, status_jsonb, observed_at)

-- Incidents
incidents (id, cluster_id, title, severity, status, started_at, resolved_at, root_cause_jsonb)
incident_signals (id, incident_id, signal_type, source, payload_jsonb, observed_at)
incident_timeline (id, incident_id, event_type, message, actor, created_at)

-- AI
ai_decisions (id, incident_id, hypothesis, confidence, evidence_jsonb, llm_model, tokens_used, created_at)
ai_embeddings (id, incident_id, embedding vector(1536))  -- pgvector

-- Remediation
remediation_actions (id, incident_id, action_type, target_jsonb, status, requested_by, approved_by, dry_run, executed_at, result_jsonb)
audit_log (id, actor, action, resource, before_jsonb, after_jsonb, created_at)

-- Reports
reports (id, incident_id, content_md, generated_at)

-- Notifications
notifications (id, incident_id, channel, recipient, status, sent_at, retry_count)

-- Settings
integrations (id, type, config_encrypted, enabled)
policies (id, name, scope, rules_yaml, enabled)
```

**Redis** — cache, sessions, rate limit, pub/sub
**Prometheus** — metrics (TSDB, no schema)
**Kafka topics** — `tagent.discovery.events`, `tagent.monitoring.signals`, `tagent.incidents.created`, `tagent.remediation.requested`

---

## 17. Deployment Architecture

```
                          ┌─────────────────┐
                          │   Ingress       │
                          │  (TLS, OIDC)    │
                          └────────┬────────┘
                                   │
                          ┌────────▼────────┐
                          │  API Gateway    │
                          │  (Go, :8080)    │
                          └────────┬────────┘
                                   │
        ┌──────────────┬───────────┼──────────────┬──────────────┐
        │              │           │              │              │
        ▼              ▼           ▼              ▼              ▼
  ┌──────────┐  ┌───────────┐ ┌──────────┐ ┌─────────────┐ ┌──────────────┐
  │Discovery │  │Monitoring │ │AI Engine │ │ Remediation │ │ Notification │
  │  (Go)    │  │   (Go)    │ │ (Python) │ │    (Go)     │ │     (Go)     │
  └────┬─────┘  └─────┬─────┘ └────┬─────┘ └──────┬──────┘ └──────┬───────┘
       │              │            │              │               │
       │              │            │              │               │
       ▼              ▼            ▼              ▼               ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │  Data Layer: PostgreSQL │ Redis │ Kafka │ Prometheus │ Loki          │
  └──────────────────────────────────────────────────────────────────────┘
                                   ▲
                                   │
                          ┌────────┴────────┐
                          │   Kubernetes    │
                          │   (Target)      │
                          └─────────────────┘
```

**All services run as Pods in the `tagent` namespace.**
**Service mesh (optional, Istio/Linkerd) for production.**

---

## 18. Release Checklist

Use this checklist before any version tag.

### 18.1 Code

- [ ] All tests pass in CI
- [ ] Code coverage ≥ targets
- [ ] No critical/high CVEs in dependencies
- [ ] No critical/high vulnerabilities in container images
- [ ] govulncheck, pip-audit, npm audit clean
- [ ] Linters clean (golangci-lint, ruff, eslint)
- [ ] No TODO/FIXME marked critical
- [ ] All public APIs documented

### 18.2 Documentation

- [ ] README.md current
- [ ] CHANGELOG.md updated
- [ ] Migration guide if breaking changes
- [ ] API docs regenerated
- [ ] Architecture docs current
- [ ] Quickstart guide tested fresh

### 18.3 Build & Distribution

- [ ] Container images built (amd64 + arm64)
- [ ] Images signed (cosign)
- [ ] SBOM published
- [ ] Helm chart linted (helm lint)
- [ ] Helm chart kubeconform-validated
- [ ] Helm chart published to repo
- [ ] GitHub release notes published
- [ ] Binaries (CLI) built and signed

### 18.4 Verification

- [ ] Fresh install on clean K8s cluster works
- [ ] Upgrade from previous version works
- [ ] Rollback to previous version works
- [ ] Smoke test scenarios pass
- [ ] Performance benchmarks met
- [ ] No regressions vs previous version

### 18.5 Communication

- [ ] Release announcement drafted
- [ ] Discord/Slack community notified
- [ ] Twitter/LinkedIn posts ready
- [ ] Blog post (for minor/major releases)
- [ ] Email to mailing list (for major releases)

---

## 19. Timeline & Effort Estimate

Realistic timeline assuming 2-3 full-time engineers.

| Phase | Duration | Engineers Needed | Cumulative |
|-------|----------|------------------|------------|
| 1. Foundation | 1-2 weeks | 1-2 | Week 2 |
| 2. Core Services | 4-6 weeks | 2-3 | Week 8 |
| 3. AI Layer | 4-6 weeks | 1-2 (Python) | Week 14 |
| 4. Frontend | 4-5 weeks | 1-2 (React) | Week 19 |
| 5. Integration & Testing | 2-3 weeks | All | Week 22 |
| 6. Deployment Pipeline | 2-3 weeks | 1 (DevOps) | Week 25 |
| 7. Security | 2-3 weeks | All + security advisor | Week 28 |
| 8. Beta Release | 4-6 weeks | All | Week 34 |
| 9. v1.0 Market Release | 2-4 weeks | All + marketing | Week 38 |
| 10. Post-launch | Ongoing | All | — |

**Optimistic GA target: ~9 months from kickoff.**
**Realistic GA target: 12 months.**

Phases 3 and 4 can run in parallel (different engineers). Phases 6 and 7 can overlap with 5.

---

## 20. Stop Criteria — When to Declare DONE

### 20.1 MVP DONE (= ready for closed alpha)

- [ ] Helm install works on a fresh cluster
- [ ] All 7 services run and pass health checks
- [ ] UI loads and shows real cluster resources
- [ ] User can ask AI a read-only question and get a response
- [ ] System detects at least one type of incident automatically
- [ ] System recommends a remediation
- [ ] User can approve and execute the remediation
- [ ] Incident report is auto-generated
- [ ] Slack notification is delivered
- [ ] Audit log records the full lifecycle
- [ ] No P0 bugs

### 20.2 Beta DONE (= ready for v1.0)

- [ ] All MVP criteria + the following:
- [ ] OIDC login works (at least one provider)
- [ ] Three RBAC roles enforced
- [ ] Documentation site live with quickstart, install, config, API
- [ ] At least 50 active beta installs
- [ ] At least 3 design partners using in production
- [ ] Performance: API p99 <200ms, dashboard load <2s
- [ ] Security: penetration test passed, no critical findings
- [ ] Multi-arch images (amd64 + arm64)
- [ ] Signed releases (cosign)
- [ ] Public chart repository

### 20.3 v1.0 GA DONE (= market release)

- [ ] All Beta criteria + the following:
- [ ] Marketing site live
- [ ] Pricing decided and documented
- [ ] Support channels operational
- [ ] Launch communications sent
- [ ] First 10 paying customers (if commercial track)
- [ ] Stable release cadence established (monthly minor, weekly patch)
- [ ] Community Slack/Discord with at least 100 members

### 20.4 Project Considered Successful (12 months post-GA)

- 1000+ GitHub stars
- 10,000+ Helm chart downloads
- 100+ active production deployments (telemetry-confirmed)
- Sustainable revenue OR sustainable funding
- Healthy contributor pipeline (5+ external contributors per month)
- Documented case studies from real users

---

## Appendix A — Where We Are RIGHT NOW

**Overall progress: Phase 1 ~30% complete. Phases 2-10 not started.**

### A.1 Done

**Repository & documentation:**
- [x] Monorepo structure (`backend/`, `deployment/`, `helm-charts/`, `scripts/`, `doc/`)
- [x] `README.md` with quickstart
- [x] `.gitignore`, `.dockerignore`, `.env.example`
- [x] `doc/Readme.md` (project documentation)
- [x] `doc/idea..md` (vision document)
- [x] `doc/DEVELOPMENT_ROADMAP.md` (this file)

**Backend service skeletons:**
- [x] API Gateway — `cmd/server/main.go`, handlers (health, clusters, incidents, ai, remediation, websocket), middleware (cors, request_id), `go.mod`
- [x] Discovery Service stub
- [x] Monitoring Service stub
- [x] Remediation Service stub
- [x] Notification Service stub
- [x] Documentation Service stub
- [x] AI Engine — FastAPI `app/main.py`, routers (chat, analysis, rca), `requirements.txt`

**Infrastructure & deployment:**
- [x] `docker-compose.dev.yml` (Postgres, Redis, Prometheus, Kafka)
- [x] `deployment/docker/api-gateway.Dockerfile`
- [x] `deployment/docker/ai-engine.Dockerfile`
- [x] `deployment/prometheus/prometheus.yml`
- [x] `helm-charts/tagent/Chart.yaml`
- [x] `helm-charts/tagent/values.yaml`

**Scripts:**
- [x] `scripts/setup.sh`
- [x] `scripts/build.sh`

### A.2 Not Done

**Phase 1 remaining:**
- [ ] `LICENSE` (MIT)
- [ ] `Makefile`
- [ ] `go.work` (Go workspace)
- [ ] Shared Go packages — `backend/shared/pkg/{logger,config,errors,k8s}/`
- [ ] `.github/workflows/ci.yml`
- [ ] `.github/workflows/release.yml`
- [ ] `.github/workflows/security.yml`
- [ ] `.github/dependabot.yml`
- [ ] `CONTRIBUTING.md`
- [ ] `CODE_OF_CONDUCT.md`
- [ ] `SECURITY.md`
- [ ] Dockerfiles for: discovery, monitoring, remediation, notification, documentation, web
- [ ] `scripts/test.sh`, `scripts/run.sh`
- [ ] Pre-commit hooks
- [ ] Helm chart `templates/` directory

**Phase 2-10:** Not started.

### A.3 Next Immediate Steps (to finish Phase 1)

In order:
- [ ] 1. Create `LICENSE` (MIT)
- [ ] 2. Create `Makefile` (build, test, run, lint, fmt, docker-build)
- [ ] 3. Create `go.work` referencing all backend services
- [ ] 4. Build shared packages: `logger`, `config`, `errors`, `k8s`
- [ ] 5. Create `.github/workflows/ci.yml`
- [ ] 6. Create `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`
- [ ] 7. Create remaining Dockerfiles (discovery, monitoring, remediation, notification, documentation)
- [ ] 8. Verify `docker compose -f docker-compose.dev.yml up -d` works
- [ ] 9. Verify API Gateway compiles with `go mod tidy && go build ./...`
- [ ] 10. Verify `/health` endpoint returns 200

**Then begin Phase 2: Core Services implementation.**

### A.4 Phase Progress Summary

- [ ] Phase 1. Foundation (~30%)
- [ ] Phase 2. Core Services (0%)
- [ ] Phase 3. AI Layer (0%)
- [ ] Phase 4. Frontend (0%)
- [ ] Phase 5. Integration & Testing (0%)
- [ ] Phase 6. Deployment Pipeline (0%)
- [ ] Phase 7. Security (0%)
- [ ] Phase 8. Beta Release (0%)
- [ ] Phase 9. v1.0 Market Release (0%)
- [ ] Phase 10. Post-Launch & Growth (0%)

**Overall project completion: ~3% (foundation only).**

---

## Appendix B — Decision Log

Major decisions and the reasoning. Update as decisions are made.

| Date | Decision | Reason |
|------|----------|--------|
| Day 1 | Monorepo over polyrepo | Easier coordination, single CI, atomic changes |
| Day 1 | Go for backend, Python only for AI | Performance, low memory, K8s ecosystem |
| Day 1 | PostgreSQL not MongoDB | Reliability, JSONB gives flexibility, pgvector for embeddings |
| Day 1 | Kafka not RabbitMQ | Stream-native for telemetry, replay capability |
| Day 1 | Helm not Kustomize as primary | Industry standard, easier user adoption |
| Day 1 | Open core not pure open source | Sustainable revenue while keeping core free |
| Day 1 | Ollama (local only) | Privacy, air-gapped, cost, no vendor lock-in |

---

**End of document.**

This file is the contract. Every implementation choice is checked against it. When something is unclear, update this document FIRST, then implement.
