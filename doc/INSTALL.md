# Tagent Installation Guide

Complete guide to installing Tagent on Kubernetes and local environments.

---

## Prerequisites

| Requirement | Minimum | Recommended |
|------------|---------|-------------|
| Kubernetes | 1.25+ | 1.28+ |
| Helm | 3.10+ | 3.14+ |
| kubectl | matching K8s | latest |
| Cluster RAM | 4 GB | 8 GB+ |
| Cluster CPU | 4 cores | 8 cores |
| Disk (Ollama models) | 10 GB | 20 GB |

---

## Quick Install (Helm)

```bash
# From chart repository
helm repo add tagent https://tagent-dev.github.io/Tagent
helm repo update
helm install tagent tagent/tagent -n tagent --create-namespace

# Or from source
git clone https://github.com/Tagent-dev/Tagent.git
cd Tagent
helm install tagent ./helm-charts/tagent -n tagent --create-namespace

# Wait for pods
kubectl wait --for=condition=ready pod --all -n tagent --timeout=300s

# Access dashboard
kubectl port-forward -n tagent svc/tagent-web 3000:3000
# Open: http://localhost:3000

# Pull AI model (first time)
kubectl exec -it -n tagent $(kubectl get pods -n tagent -l app=ollama -o name) \
  -- ollama pull llama3.2:1b
kubectl exec -it -n tagent $(kubectl get pods -n tagent -l app=ollama -o name) \
  -- ollama pull nomic-embed-text
```

---

## Install on Kind (Local Kubernetes)

```bash
# Create cluster
kind create cluster --name tagent-dev --config - <<EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
  - role: worker
EOF

# Install Tagent
helm install tagent ./helm-charts/tagent -n tagent --create-namespace

# Access
kubectl port-forward -n tagent svc/tagent-web 3000:3000
```

---

## Install on Minikube

```bash
minikube start --cpus=4 --memory=8192 --driver=docker
helm install tagent ./helm-charts/tagent -n tagent --create-namespace
minikube service tagent-web -n tagent
```

---

## Install on EKS (AWS)

```bash
# Create cluster (if needed)
eksctl create cluster --name tagent --region us-east-1 --nodes 2

# Install with LoadBalancer
helm install tagent ./helm-charts/tagent -n tagent --create-namespace \
  --set web.service.type=LoadBalancer

# Get external URL
kubectl get svc -n tagent tagent-web
```

---

## Install on GKE (Google Cloud)

```bash
gcloud container clusters create tagent --num-nodes=2 --zone=us-central1-a
gcloud container clusters get-credentials tagent --zone=us-central1-a
helm install tagent ./helm-charts/tagent -n tagent --create-namespace \
  --set web.service.type=LoadBalancer
```

---

## Install on AKS (Azure)

```bash
az aks create -g tagent-rg -n tagent-cluster --node-count 2
az aks get-credentials -g tagent-rg -n tagent-cluster
helm install tagent ./helm-charts/tagent -n tagent --create-namespace \
  --set web.service.type=LoadBalancer
```

---

## Local Development (No Kubernetes)

```bash
git clone https://github.com/Tagent-dev/Tagent.git && cd Tagent
docker compose -f docker-compose.dev.yml up -d
docker compose exec ollama ollama pull llama3.2:1b
# See CONTRIBUTING.md for running individual services
```

---

## Configuration (values.yaml overrides)

```yaml
remediation:
  mode: "read-only"          # read-only | approval-required | auto
nightGuardian:
  enabled: false
  confidence: "85"
ollama:
  enabled: true
  model: "llama3.2:1b"
  embeddingModel: "nomic-embed-text"
  persistence:
    enabled: true
    size: 20Gi
web:
  service:
    type: ClusterIP          # LoadBalancer for cloud
```

---

## Upgrading

```bash
helm repo update
helm upgrade tagent tagent/tagent -n tagent
# Or from source: helm upgrade tagent ./helm-charts/tagent -n tagent
```

---

## Uninstalling

```bash
helm uninstall tagent -n tagent
kubectl delete namespace tagent
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Pods Pending | `kubectl describe pod -n tagent <pod>` — check resources |
| Ollama unreachable | Pull model: `kubectl exec ... -- ollama pull llama3.2:1b` |
| AI Engine degraded | `kubectl logs -n tagent -l app=ai-engine --tail=50` |
| Frontend blank | Check gateway: `kubectl logs -n tagent -l app=api-gateway` |

```bash
# Useful debug commands
kubectl get pods -n tagent
kubectl get events -n tagent --sort-by='.lastTimestamp'
kubectl top pods -n tagent
kubectl logs -n tagent -l app=<service> --tail=100
```

---

## Air-Gapped Installation

No outbound internet required after initial setup:
1. Pre-pull images, load into cluster
2. `imagePullPolicy: IfNotPresent` (default)
3. Pre-load Ollama models into PersistentVolume
4. Install from local chart: `helm install tagent ./tagent-0.1.0.tgz -n tagent --create-namespace`
