# Tagent Developer Guide

Deep-dive guide for contributors. Read CONTRIBUTING.md first for setup.

---

## Service Architecture

| Service | Language | Port | Key Responsibility |
|---------|----------|------|-------------------|
| API Gateway | Go/Gin | 8080 | Routing, auth, WebSocket, rate limit |
| Discovery | Go | 8081 | K8s resource scanning, topology |
| Monitoring | Go | 8082 | Prometheus queries, incident detection |
| AI Engine | Python/FastAPI | 8083 | LLM chat, RCA, plugins (Ollama only) |
| Remediation | Go | 8084 | K8s actions, Night Guardian |
| Notification | Go | 8085 | Slack, email, escalation |
| Web | Next.js | 3000 | Dashboard UI |

---

## Data Flow

```
Detection: Monitoring -> Kafka (incidents.detected) -> Notification
AI Chat: Browser -> Next.js proxy -> Gateway -> AI Engine -> Ollama
Remediation: AI suggests -> approval queue -> Remediation -> K8s API
Knowledge: AI Engine -> embed via Ollama -> store in pgvector -> cosine search
```

---

## Adding a New Go Service Feature

1. Navigate to the service: `cd backend/services/<service>/`
2. Add handler in `internal/handlers/`
3. Register route in `cmd/server/main.go`
4. Add tests in `*_test.go`
5. Run: `go build ./... && go test ./... -short`

---

## Adding a New AI Engine Router

1. Create `app/routers/your_feature.py`
2. Define FastAPI router with endpoints
3. Register in `app/main.py`: `app.include_router(...)`
4. All LLM calls MUST use `from app.providers import OllamaProvider`
5. Run: `ruff check . && pytest`

---

## Adding a Frontend Page

1. Create `src/app/your-page/page.tsx`
2. Add navigation item in `src/components/Nav.tsx`
3. Use `lib/api.ts` for data fetching
4. Use Tailwind CSS (dark theme: zinc-950 background)
5. Run: `npm run type-check && npm run build`

---

## Adding a Plugin

See `doc/PLUGIN_SDK.md` for full details. Quick version:

```python
from app.plugins.sdk import DetectorPlugin, Detection

class MyDetector(DetectorPlugin):
    name = "my-detector"
    version = "1.0.0"
    description = "Detects my condition"

    def detect(self, cluster_data: dict) -> list[Detection]:
        # Your detection logic
        return []
```

Install via API or place in `/data/plugins/`.

---

## Key Configuration Files

| File | Purpose |
|------|---------|
| `docker-compose.dev.yml` | Local infrastructure |
| `helm-charts/tagent/values.yaml` | K8s deployment config |
| `frontend/web/package.json` | Frontend dependencies |
| `backend/services/ai-engine/requirements.txt` | Python deps |
| `backend/services/*/go.mod` | Go module dependencies |
| `.github/workflows/ci.yml` | CI pipeline |

---

## Environment Variables

| Variable | Service | Default | Purpose |
|----------|---------|---------|---------|
| OLLAMA_ENDPOINT | AI Engine | http://localhost:11434 | Ollama URL |
| OLLAMA_MODEL | AI Engine | llama3.2:1b | Chat model |
| OLLAMA_EMBEDDING_MODEL | AI Engine | nomic-embed-text | Embedding model |
| DATABASE_URL | All Go | postgresql://... | PostgreSQL |
| REDIS_URL | Gateway | redis://localhost:6379 | Redis cache |
| KAFKA_BROKERS | Monitoring | localhost:9092 | Kafka |
| PORT | All | varies per service | Listen port |

---

## Testing Strategy

| Level | Tool | Target Coverage |
|-------|------|----------------|
| Go unit tests | `go test` + testify | 70% |
| Python tests | pytest + pytest-asyncio | 70% |
| Frontend tests | Vitest | 60% |
| E2E tests | Playwright | Critical paths |
| Helm tests | helm lint + template | 100% render |

---

## Common Tasks

### Run a single Go service
```bash
cd backend/services/api-gateway
go run cmd/server/main.go
```

### Test AI chat locally
```bash
curl -X POST http://localhost:8083/api/v1/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"How many pods are running?"}'
```

### Build Docker images locally
```bash
docker build -f deployment/docker/api-gateway.Dockerfile -t tagent-api-gateway .
docker build -f deployment/docker/ai-engine.Dockerfile -t tagent-ai-engine .
docker build -f deployment/docker/web.Dockerfile -t tagent-web .
```

### Render Helm templates
```bash
helm template tagent ./helm-charts/tagent > /tmp/rendered.yaml
```
