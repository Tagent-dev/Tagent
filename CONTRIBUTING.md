# Contributing to Tagent

Welcome! Tagent is an open-source AI-powered Kubernetes SRE platform. We're glad you want to help.

Whether you're fixing a typo, adding a feature, improving docs, or reporting a bug — every contribution matters. This guide will help you get started quickly.

---

## Table of Contents

- [Quick Start (I just want to contribute!)](#quick-start)
- [Development Environment Setup](#development-environment-setup)
- [Project Architecture](#project-architecture)
- [Running the Project Locally](#running-the-project-locally)
- [Running with Kubernetes (Helm)](#running-with-kubernetes-helm)
- [Running Tests](#running-tests)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Code Style & Standards](#code-style--standards)
- [Hard Constraints](#hard-constraints)
- [Issue Guidelines](#issue-guidelines)
- [Community](#community)

---

## Quick Start

```bash
# 1. Fork and clone
git clone https://github.com/YOUR-USERNAME/Tagent.git
cd Tagent

# 2. Start infrastructure (Postgres, Redis, Kafka, Ollama)
docker compose -f docker-compose.dev.yml up -d

# 3. Run the frontend
cd frontend/web && npm install && npm run dev

# 4. Run the AI Engine
cd backend/services/ai-engine
pip install -r requirements.txt
uvicorn app.main:app --port 8083 --reload

# 5. Run the API Gateway
cd backend/services/api-gateway
go run cmd/server/main.go
```

Open http://localhost:3000 — you should see the Tagent dashboard.

---

## Development Environment Setup

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Git | 2.30+ | Version control |
| Docker + Compose | 24+ | Local infrastructure |
| Go | 1.22+ | Backend services |
| Python | 3.11+ | AI Engine |
| Node.js | 22+ | Frontend |
| npm | 10+ | Package manager |
| kubectl | 1.28+ | K8s (optional for Helm install) |
| Helm | 3.14+ | K8s deployment (optional) |
| kind or minikube | latest | Local K8s cluster (optional) |

### Install Dependencies

**macOS:**
```bash
brew install go python@3.11 node docker kubectl helm kind
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y golang python3.11 python3.11-venv python3-pip nodejs npm docker.io
curl -LO "https://dl.k8s.io/release/$(curl -Ls https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl && sudo mv kubectl /usr/local/bin/
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

**Windows (scoop):**
```powershell
scoop install go python nodejs docker kubectl helm kind
```

### Clone and Setup

```bash
git clone https://github.com/YOUR-USERNAME/Tagent.git
cd Tagent

# Start infrastructure containers
docker compose -f docker-compose.dev.yml up -d

# Verify all containers are running
docker compose -f docker-compose.dev.yml ps

# Pull AI model (first time only)
docker compose exec ollama ollama pull llama3.2:1b
docker compose exec ollama ollama pull nomic-embed-text
```

---

## Project Architecture

```
Tagent/
├── backend/services/
│   ├── api-gateway/       # Go/Gin — :8080 — Entry point, auth, routing
│   ├── discovery/         # Go — :8081 — K8s resource scanning
│   ├── monitoring/        # Go — :8082 — Prometheus, incident detection
│   ├── ai-engine/         # Python/FastAPI — :8083 — LLM, RCA, plugins
│   ├── remediation/       # Go — :8084 — K8s actions, Night Guardian
│   ├── notification/      # Go — :8085 — Slack, email, escalation
│   └── documentation/     # Go — :8086 — Report generation
├── backend/shared/pkg/    # Shared Go libraries
├── frontend/web/          # Next.js 15 + TypeScript + Tailwind
├── cli/                   # Go CLI tool
├── helm-charts/tagent/    # Kubernetes Helm chart (20 templates)
├── deployment/docker/     # Dockerfiles for all services
├── doc/                   # Project documentation
├── scripts/               # Build & setup scripts
└── .github/workflows/     # 16 CI/CD pipelines
```

---

## Running the Project Locally

### Option A: Individual Services (Recommended for development)

Start only infrastructure, then run services you're working on:

```bash
# Infrastructure (Postgres, Redis, Kafka, Prometheus, Ollama)
docker compose -f docker-compose.dev.yml up -d

# Frontend (terminal 1)
cd frontend/web
npm install --legacy-peer-deps
npm run dev
# Access: http://localhost:3000

# API Gateway (terminal 2)
cd backend/services/api-gateway
go mod tidy
go run cmd/server/main.go
# Access: http://localhost:8080/health

# AI Engine (terminal 3)
cd backend/services/ai-engine
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --port 8083 --reload
# Access: http://localhost:8083/health
```

### Option B: Full Kubernetes (Helm Install)

For testing the full platform as deployed in production:

```bash
# Create a local K8s cluster
kind create cluster --name tagent-dev

# Install Tagent via Helm
helm install tagent ./helm-charts/tagent \
  --namespace tagent --create-namespace

# Wait for pods (2-3 minutes)
kubectl wait --for=condition=ready pod --all -n tagent --timeout=180s

# Check pod status
kubectl get pods -n tagent

# Access the UI
kubectl port-forward -n tagent svc/tagent-web 3000:3000

# Access API Gateway
kubectl port-forward -n tagent svc/tagent-api-gateway 8080:8080

# Pull AI model inside cluster (first time)
kubectl exec -it -n tagent $(kubectl get pods -n tagent -l app=ollama -o name) \
  -- ollama pull llama3.2:1b
```

### Verify Your Setup

```bash
curl http://localhost:8080/health    # API Gateway -> {"status":"healthy"}
curl http://localhost:8083/health    # AI Engine -> {"status":"healthy"}
open http://localhost:3000           # Dashboard loads
```

---

## Running Tests

```bash
# Go services
cd backend/services/api-gateway && go test ./... -v -short

# Python AI Engine
cd backend/services/ai-engine && pytest --tb=short -q

# Frontend
cd frontend/web
npm run type-check && npm run lint && npm run test && npm run build

# Helm chart
helm lint helm-charts/tagent
helm template tagent helm-charts/tagent
```

---

## Making Changes

### Branch Naming
- `feat/your-feature` — new features
- `fix/issue-42-description` — bug fixes
- `docs/update-install-guide` — documentation
- `refactor/extract-middleware` — code cleanup

### Commit Messages (Conventional Commits)
```
feat(discovery): add HPA watcher with K8s informer
fix(ai-engine): handle Ollama timeout during RCA
docs(contributing): add Helm installation guide
test(monitoring): add unit tests for detection
```
Types: `feat` `fix` `docs` `test` `ci` `refactor` `chore` `perf`

### Before Submitting
```bash
# Go: format + vet + build + test
cd backend/services/<service>
go fmt ./... && go vet ./... && go build ./... && go test ./... -short

# Python: lint + test
cd backend/services/ai-engine
ruff check . && ruff format . && pytest --tb=short

# Frontend: lint + type-check + build
cd frontend/web
npm run lint && npm run type-check && npm run build

# Helm
helm lint helm-charts/tagent
```

---

## Pull Request Process

1. Open a PR against `main`
2. Fill out the PR template (what, why, how to test)
3. Ensure CI passes (all checks green)
4. A maintainer reviews within 48 hours
5. Address feedback with additional commits
6. Maintainer squash-merges after approval

---

## Code Style

| Language | Formatter | Linter | Test Framework |
|----------|-----------|--------|----------------|
| Go | `gofmt` | `golangci-lint` | `testing` + `testify` |
| Python | `ruff format` | `ruff check` | `pytest` |
| TypeScript | Prettier | ESLint | Vitest + Playwright |
| Helm | — | `helm lint` | `helm test` |

---

## Hard Constraints (Will Block PRs)

1. **Local Models Only** — No cloud LLM SDKs. Tagent uses Ollama. See `doc/AI_REQUIREMENTS.md`.
2. **Safety-First** — Destructive K8s actions require human approval.
3. **Kubernetes-Native** — All features must work in K8s.
4. **Privacy** — No telemetry data ever leaves the cluster.

---

## What Can I Contribute?

| Area | Skills | Start Here |
|------|--------|-----------|
| Backend (Go) | Go, K8s, Kafka | `backend/services/` |
| AI Engine | Python, FastAPI | `backend/services/ai-engine/` |
| Frontend | TypeScript, React, Tailwind | `frontend/web/src/` |
| Helm Chart | K8s, Helm | `helm-charts/tagent/` |
| CLI | Go, Cobra | `cli/` |
| Docs | Markdown | `doc/`, `CONTRIBUTING.md` |
| CI/CD | GitHub Actions, Docker | `.github/workflows/` |

Look for [`good-first-issue`](https://github.com/Tagent-dev/Tagent/labels/good-first-issue) labels.

---

## Community

- **GitHub Issues** — Bugs and features
- **GitHub Discussions** — Questions and ideas
- **Discord** — Real-time chat (link in README)

---

## License

By contributing, you agree your contributions are licensed under [Apache License 2.0](LICENSE).

---

Thank you for contributing! Every improvement makes K8s operations less painful for teams worldwide.
