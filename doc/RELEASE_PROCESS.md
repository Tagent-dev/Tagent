# Release Process — From PR to Published Release

This is the end-to-end workflow for shipping a change in Tagent, from opening a
pull request through to a published GitHub Release, Docker images, and a Helm
chart that users can `helm install`.

It documents the exact steps and the automation that runs behind them, so any
collaborator can ship a release confidently.

---

## Overview

```
 feature branch ──▶ Pull Request ──▶ CI green ──▶ squash-merge to main
                                                        │
                                                        ▼
                                             tag  vX.Y.Z  on main
                                                        │
                          ┌─────────────────────────────┼─────────────────────────────┐
                          ▼                             ▼                              ▼
                  Build Images                     Release                       (docs / CLI)
              yaswanth111/tagent-*:vX.Y.Z    GitHub Release + notes         CLI binaries
                                             Helm chart ▶ gh-pages
```

Two GitHub Actions workflows react to a `v*` tag:

| Workflow | Trigger | What it publishes |
|----------|---------|-------------------|
| `.github/workflows/build-images.yml` | push to `main`, tags `v*` | Multi-arch Docker images tagged `vX.Y.Z` |
| `.github/workflows/release.yml` | tags `v*`, manual dispatch | GitHub Release, Helm chart (to `gh-pages`), CLI binaries |

The Helm repo index lives on the `gh-pages` branch and is served at
`https://tagent-dev.github.io/Tagent/index.yaml`. Publishing a chart appends its
entry there, which is what makes `helm repo update` see the new version.

---

## Step 1 — Branch and commit

Follow the branch naming and Conventional Commits rules in `CONTRIBUTING.md`.

```bash
git checkout -b feat/your-feature
# ... make changes ...
git add <specific files>
git commit -m "feat(scope): short description"
```

Stage files explicitly. Avoid `git add .` so unrelated working-tree changes are
not swept into the commit.

---

## Step 2 — Verify locally before pushing

Run the same checks CI runs. A green local run avoids a red PR.

```bash
# Go services
cd backend/services/<service>
go fmt ./... && go vet ./... && go build ./... && go test ./... -short

# AI Engine (Python)
cd backend/services/ai-engine
ruff check . && pytest --tb=short -q

# Frontend
cd frontend/web
npm run type-check && npm run lint && npm run build

# Helm chart
helm lint helm-charts/tagent
helm template tagent helm-charts/tagent > /tmp/rendered.yaml
```

**Local models only:** never introduce cloud LLM SDKs or API keys. See
`.kiro/steering/local-models-only.md` and `doc/AI_REQUIREMENTS.md`.

---

## Step 3 — Open the Pull Request

```bash
git push -u origin feat/your-feature
gh pr create --base main --head feat/your-feature \
  --title "feat(scope): short description" \
  --body-file ./PR_BODY.md
```

Write a body that covers **what changed, why, and how it was verified**. Tip: use
`--body-file` for multi-line descriptions with code blocks — inline `--body`
strings mangle backticks in some shells.

---

## Step 4 — Get CI green

```bash
gh pr checks <pr-number>          # summary of all checks
gh pr checks <pr-number> --watch  # follow until they finish
```

All of these must pass before merge:

- `lint-go` (api-gateway, discovery, monitoring, notification, remediation)
- `lint-python`, `lint-frontend`, `lint-helm`
- CodeQL `Analyze` (go / python / javascript-typescript)

If a check fails, read the failing job log and fix the root cause:

```bash
gh run view <run-id> --log-failed
```

---

## Step 5 — Merge to main

Maintainer squash-merges after approval:

```bash
gh pr merge <pr-number> --squash --delete-branch
```

Confirm it landed:

```bash
gh pr view <pr-number> --json state,mergedAt,mergeCommit \
  --jq "{state, mergedAt, mergeCommit: .mergeCommit.oid}"
```

Merging to `main` also builds `:latest` images via `build-images.yml`.

---

## Step 6 — Bump the chart version (before tagging)

If the release changes the Helm chart, bump `version` in
`helm-charts/tagent/Chart.yaml` **in the PR** (chart repos reject re-publishing
an existing version). `appVersion` tracks the app release; `version` tracks the
chart.

```yaml
version: 0.5.1      # chart version — bump on any chart change
appVersion: "0.5.0" # application version
```

---

## Step 7 — Tag the release

The tag is what triggers image builds and the release. Tag the merge commit on
`main`.

```bash
git fetch origin --tags
git tag -a v0.5.1 <merge-commit-sha> -m "Tagent v0.5.1 — <summary>"
git push origin v0.5.1
```

Use annotated tags (`-a`) and the `vMAJOR.MINOR.PATCH` format.

---

## Step 8 — Watch the release workflows

```bash
gh run list --limit 6
gh run view <release-run-id> --json jobs \
  --jq ".jobs[] | {name, status, conclusion}"
```

Expected outcome:

| Job | Result | Notes |
|-----|--------|-------|
| `release-github` | ✅ | Creates the GitHub Release + changelog |
| `release-helm` | ✅ | Packages chart, updates `gh-pages` index |
| `build-images` (separate workflow) | ✅ | Pushes `yaswanth111/tagent-*:vX.Y.Z` |
| `release-cli` | ⚠️ known issue | See "Known issues" below |

---

## Step 9 — Verify the release is live

```bash
# Chart is published and indexed
curl -s https://tagent-dev.github.io/Tagent/index.yaml | grep -A1 "version:"

# Images exist (pull one to confirm)
docker pull yaswanth111/tagent-web:v0.5.1

# GitHub Release is visible
gh release view v0.5.1
```

---

## Step 10 — Deploy / upgrade

```bash
helm repo update
helm upgrade tagent tagent/tagent -n tagent --reuse-values
```

For UI access options (NodePort / LoadBalancer / port-forward), see the "Access
the UI" section in the root `README.md` and `helm-charts/tagent/README.md`.

---

## Known issues

- **`release-cli` job fails.** The CLI matrix pins `go-version: "1.26"`, which
  does not exist (the project standardizes on Go 1.23). This job failing does
  **not** block image builds or chart publishing — they only depend on
  `release-github`. Fix: set the CLI `go-version` to `1.23` in
  `.github/workflows/release.yml`.

- **EKS/GKE/AKS NodePort range.** Managed clusters only allow NodePorts in
  `30000–32767`. The chart defaults `web.service.nodePort` to `31777` for this
  reason. Do not set it outside that range for managed clusters.

---

## Quick reference

```bash
# 1. branch + commit + verify
git checkout -b feat/x && git commit -m "feat: x"
# 2. PR
gh pr create --base main --body-file ./PR_BODY.md
# 3. checks
gh pr checks <pr> --watch
# 4. merge
gh pr merge <pr> --squash --delete-branch
# 5. bump Chart.yaml version (if chart changed)
# 6. tag + push
git tag -a v0.5.1 <sha> -m "Tagent v0.5.1" && git push origin v0.5.1
# 7. verify
curl -s https://tagent-dev.github.io/Tagent/index.yaml | grep -A1 version
```
