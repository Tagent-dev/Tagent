# AI Models — Local-First with Optional Cloud Keys (BYOK) — Design Spec

Status: **DESIGN / PROPOSAL** (not yet implemented)
Owner: Tagent
Related: `doc/AI_REQUIREMENTS.md`, `.kiro/steering/local-models-only.md`

> This document describes how Tagent should let users run **local models by
> default** and **optionally switch to a cloud LLM** by adding their own API key
> (Bring-Your-Own-Key / BYOK). It is a design spec — a reference for whoever
> implements the feature. No behavior changes until this is built.

---

## 1. Product intent

Tagent should support two modes, chosen by the user, with **local as the default**:

1. **Local mode (default).** On `helm install`, a lightweight local model
   (Ollama `llama3.2:1b`) is deployed automatically. Everything runs on the
   user's own hardware — no data leaves the cluster.
2. **Cloud mode (opt-in, BYOK).** From the UI, a user can instead add a cloud
   provider API key (OpenAI, Gemini, Anthropic, etc.). Once a key is added, the
   platform routes LLM calls through that cloud provider instead of Ollama.

The user picks; Tagent never silently uses cloud.

---

## 2. User journey

```
1. helm install tagent tagent/tagent
      → lightweight local model (llama3.2:1b) starts automatically
      → AI features work immediately, fully local

2. Open the UI → "AI Models" page. Three choices:
      a. Keep the default small local model
      b. Pull a BIGGER open-source local model (still local, via Ollama)
      c. Switch to CLOUD: add an API key (OpenAI / Gemini / Anthropic / ...)

3. If the user chooses CLOUD:
      → user pastes their API key in the UI
      → backend stores it as a Kubernetes Secret (NOT a plaintext file)
      → the AI Engine switches its active provider to that cloud provider
      → all LLM calls (chat, RCA, briefing, risk) now use the cloud key

4. The user can remove the key later → platform falls back to local Ollama.
```

---

## 3. How users add keys (the exact flow)

### 3.1 In the UI (AI Models page → "Cloud Providers" / "API Keys" tab)

- A list of supported providers, each a card:
  - Provider name + logo (OpenAI, Google Gemini, Anthropic, …)
  - An **API key** input field (password type, masked, with a show/hide eye)
  - A **model** dropdown (e.g. for OpenAI: `gpt-4o`, `gpt-4o-mini`; Gemini:
    `gemini-2.0-flash`, `gemini-1.5-pro`)
  - **Save & Activate** button
  - Status pill: `Not configured` / `Connected` / `Active`
  - **Remove key** button (for connected providers)
- Only one provider is "Active" at a time. Activating a cloud provider
  deactivates Ollama; removing all cloud keys reactivates Ollama.

### 3.2 What happens in the backend when a key is saved

```
UI  ──POST /api/v1/models/cloud/key { provider_id, api_key, model } ──▶ API Gateway
API Gateway ── proxy ──▶ AI Engine  POST /api/v1/models/cloud/key
AI Engine:
   1. Validate provider_id is a supported provider
   2. Create/patch a Kubernetes Secret:
        name: tagent-llm-<provider_id>      (e.g. tagent-llm-openai)
        namespace: <release namespace>
        data: { api-key: <base64> }
   3. Record which provider is now "active" (Secret or ConfigMap flag)
   4. Return { status: "stored", provider, active: true }
```

> IMPORTANT: the key is stored in a **Kubernetes Secret**, not in a Pod and not
> in plaintext. (Earlier phrasing said "create a pod" — the correct K8s
> primitive for a credential is a Secret. No extra Pod is created.)

### 3.3 How the AI Engine uses the key at request time

```
On each LLM call the AI Engine selects a provider:
   if an active cloud Secret exists:
        read tagent-llm-<active>            (api-key)
        use the matching cloud provider (OpenAI / Gemini / Anthropic)
   else:
        use the local OllamaProvider (default)
```

All providers implement the same `LLMProvider` interface (`chat`, `stream`,
`embed`, `health`) so the rest of the code does not change.

---

## 4. Supported providers (proposed)

| Provider | id | Example models | Key env / secret |
|----------|----|----------------|------------------|
| Ollama (local, default) | `ollama` | `llama3.2:1b`, `llama3.1:8b` | — (no key) |
| OpenAI | `openai` | `gpt-4o`, `gpt-4o-mini` | `tagent-llm-openai` |
| Google Gemini | `gemini` | `gemini-2.0-flash`, `gemini-1.5-pro` | `tagent-llm-gemini` |
| Anthropic | `anthropic` | `claude-3-5-sonnet`, `claude-3-5-haiku` | `tagent-llm-anthropic` |

(Final provider list is a product decision — start with OpenAI + Gemini if
preferred, add others later.)

---

## 5. API surface (to re-add)

| Method | Path (gateway) | Purpose |
|--------|----------------|---------|
| POST | `/api/v1/models/cloud/key` | Store a provider key + activate |
| GET | `/api/v1/models/cloud/keys` | List which providers have a key / which is active |
| DELETE | `/api/v1/models/cloud/key/:provider` | Remove a key (fall back to local) |
| GET | `/api/v1/models/active` | Report the currently active provider + model |

The gateway proxies these to the AI Engine, which owns the Secret logic.

---

## 6. Implementation checklist (when built)

- [ ] **Policy/docs first:** update `.kiro/steering/local-models-only.md` to
      "local-first, optional user-supplied cloud keys"; update
      `doc/AI_REQUIREMENTS.md`, README, CONTRIBUTING.md messaging.
- [ ] **AI Engine providers:** add `openai_provider.py`, `gemini_provider.py`
      (and/or `anthropic_provider.py`) implementing `LLMProvider`.
- [ ] **Provider selector:** pick cloud vs Ollama based on active Secret.
- [ ] **AI Engine endpoints:** re-add `/models/cloud/key`, `/cloud/keys`,
      `/cloud/key/:provider`; K8s Secret create/read/delete helpers.
- [ ] **API Gateway:** re-add the cloud key proxy routes.
- [ ] **Frontend:** re-add the "Cloud Providers / API Keys" tab on the Models
      page (masked input, provider cards, active status, remove).
- [ ] **Helm RBAC:** grant the AI Engine ServiceAccount create/get/delete on
      Secrets in the release namespace.
- [ ] **Safety:** never log key values; mask in API responses; only expose
      "has_key: true/false" and the active provider.

---

## 7. Security notes

- Keys live only in Kubernetes Secrets in the release namespace — never in
  logs, never returned in API responses.
- When a cloud provider is active, prompts and cluster context are sent to that
  provider — this is the user's explicit choice and should be surfaced in the UI
  ("Data is sent to <provider> when cloud mode is active").
- Local mode remains the privacy-preserving default and the recommended option
  for air-gapped / compliance-sensitive deployments.

---

## 8. Open decisions (need product sign-off)

1. Which providers ship first (OpenAI + Gemini, or the full set)?
2. Does activating cloud **stop/scale-down** the Ollama pod to save resources,
   or leave it running as a fallback?
3. Per-user keys vs per-cluster keys (this spec assumes per-cluster).
