# Tagent Helm Chart

AI-powered Kubernetes Incident Intelligence & Auto-Remediation platform.

## Install from the Helm Repository

> The chart repo URL is `https://tagent-dev.github.io/Tagent`.

### 1. Add the Helm repo

```bash
helm repo add tagent https://tagent-dev.github.io/Tagent
helm repo update
```

### 2. Install

**Local cluster (minikube, kind, Docker Desktop, Rancher Desktop):**

```bash
helm install tagent tagent/tagent \
  --namespace tagent \
  --create-namespace \
  -f https://raw.githubusercontent.com/Tagent-dev/Tagent/main/helm-charts/tagent/values-development.yaml
```

**EKS (production):**

```bash
helm install tagent tagent/tagent \
  --namespace tagent \
  --create-namespace \
  -f https://raw.githubusercontent.com/Tagent-dev/Tagent/main/helm-charts/tagent/values-production.yaml \
  --set ingress.hosts[0].host=tagent.yourdomain.com
```

### 3. Verify

```bash
kubectl get pods -n tagent
kubectl get svc  -n tagent
kubectl get ingress -n tagent
```

You should see `tagent-web` pod running.

### 4. Access the UI

The chart defaults to **Method 1 (NodePort on port 31777)**. Choose the one that
fits your cluster.

#### Method 1 — NodePort (default)

The UI is exposed on every node at port `31777` (in the 30000-32767 range that
EKS/GKE/AKS allow, so it works on managed and self-managed clusters alike).

```bash
kubectl get nodes -o wide     # grab a node IP
```

Open: `http://<NodeIP>:31777`

> If your nodes are **private** (e.g. EKS behind an EC2 bastion) the node IP is
> not reachable from outside the VPC. Use Method 2 or Method 3 instead.

#### Method 2 — LoadBalancer (public entry, any cloud)

A cloud load balancer is provisioned; the UI is reached via the LB address
(not a node/EC2 IP).

```bash
helm upgrade tagent tagent/tagent -n tagent \
  --reuse-values \
  --set web.service.type=LoadBalancer
kubectl get svc -n tagent tagent-web
```

Open: `http://<EXTERNAL-IP>:7777`

#### Method 3 — port-forward (any service type, no chart change)

Run from a machine that can reach the cluster (e.g. your EC2 bastion):

```bash
kubectl port-forward -n tagent svc/tagent-web 7777:7777 --address 0.0.0.0
```

Open: `http://<YOUR-SERVER-IP>:7777` (or `http://localhost:7777` on that machine)

## Upgrade

```bash
helm repo update
helm upgrade tagent tagent/tagent -n tagent
```

## Uninstall

```bash
helm uninstall tagent -n tagent
kubectl delete namespace tagent
```

## Configuration

See `values.yaml` for all available options. Common overrides:

| Setting | Default | Description |
|---------|---------|-------------|
| `web.replicaCount` | 1 | Number of frontend pods |
| `web.image.repository` | `yaswanth111/tagent-web` | Container image |
| `web.image.tag` | `latest` | Image tag |
| `web.service.type` | `NodePort` | `NodePort`, `LoadBalancer`, `ClusterIP` |
| `web.service.port` | `7777` | Service port |
| `web.service.nodePort` | `31777` | NodePort (EKS/GKE/AKS require 30000-32767) |
| `web.apiUrl` | `http://tagent-api-gateway:8080` | Backend API URL |
| `ingress.enabled` | `false` | Enable Ingress |
| `ingress.className` | `""` | `alb` for EKS, `nginx` for nginx-ingress |
| `ingress.hosts[0].host` | `tagent.local` | Hostname |
